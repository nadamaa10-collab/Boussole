import { addDays, type ISODate } from "./dates";
import type { CurrencyCode } from "./money";
import type { Account, FinanceData, FxRate } from "./types";

export interface SetupInput {
  companyName: string;
  country?: string;
  baseCurrency: CurrencyCode;
  vatRegistered: boolean;
  accounts: { name: string; kind: Account["kind"]; currency: CurrencyCode; balance: number; /** Date du solde (le matin). Par défaut : aujourd'hui. */ date?: ISODate }[];
  /** Taux saisis par l'utilisateur pour les comptes dans une autre devise (1 devise du compte = x devise principale). */
  rates?: Record<CurrencyCode, number>;
}

/** Données de départ vides : seulement les comptes et leur solde du jour. Aucune donnée fictive. */
export function buildEmptyData(input: SetupInput, today: ISODate): FinanceData {
  const rates: FxRate[] = Object.entries(input.rates ?? {})
    .filter(([cur, rate]) => cur !== input.baseCurrency && rate > 0)
    .map(([from, rate]) => ({ from, to: input.baseCurrency, rate, date: today, source: "Saisie manuelle" }));
  return {
    settings: {
      companyName: input.companyName.trim() || "Mon entreprise",
      country: input.country,
      baseCurrency: input.baseCurrency,
      locale: "fr-FR",
      vatRegistered: input.vatRegistered,
      fiscalYearStartMonth: 1,
      levies: [],
      budgetThresholds: { warning: 0.8, over: 1 },
      inactiveMonths: [],
      incompleteMonths: [],
    },
    accounts: input.accounts.map((a, i) => ({
      id: `compte-${i + 1}`,
      name: a.name.trim() || `Compte ${i + 1}`,
      kind: a.kind,
      currency: a.currency,
      openingBalance: a.balance,
      // Le solde saisi est celui du matin de sa date : il inclut tout jusqu'à la veille, pas les opérations du jour.
      openingDate: addDays(a.date && a.date <= today ? a.date : today, -1),
      source: "manuel",
    })),
    invoices: [],
    payments: [],
    movements: [],
    recurrences: [],
    rates,
    budgets: [],
    version: DATA_VERSION,
  };
}

export const DATA_VERSION = 2;

/**
 * Migration des données enregistrées.
 * v1 → v2 : le solde de départ était daté du jour de la saisie, ce qui ignorait
 * les opérations de ce même jour. Il est désormais daté de la veille (solde du matin).
 */
export function migrateData(data: FinanceData): FinanceData {
  if (data.demo || (data.version ?? 1) >= DATA_VERSION) return data;
  return {
    ...data,
    accounts: data.accounts.map((a) => (a.source === "manuel" ? { ...a, openingDate: addDays(a.openingDate, -1) } : a)),
    version: DATA_VERSION,
  };
}
