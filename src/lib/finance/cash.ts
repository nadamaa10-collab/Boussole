import { addDays, type ISODate } from "./dates";
import { convert, type RateQuote } from "./fx";
import { roundMoney, sumMoney } from "./money";
import type { Account, FinanceData } from "./types";

export type FlowKind = "exploitation" | "investissement" | "financement" | "interne";

/** Mouvement d'argent effectif sur un compte, dans la devise du compte. */
export interface CashFlow {
  accountId: string;
  date: ISODate;
  /** Positif = entrée, négatif = sortie. */
  amount: number;
  kind: FlowKind;
  label: string;
  sourceId: string;
}

/** Tous les mouvements réels (paiements, frais, apports, emprunts, transferts…). */
export function cashFlows(data: FinanceData): CashFlow[] {
  const flows: CashFlow[] = [];
  for (const p of data.payments) {
    const inv = p.invoiceId ? data.invoices.find((i) => i.id === p.invoiceId) : undefined;
    const rec = p.recurrenceId ? data.recurrences.find((r) => r.id === p.recurrenceId) : undefined;
    const incoming = inv ? inv.kind === "client" : rec ? rec.kind === "recette" : p.amount > 0;
    const kind: FlowKind = inv?.nature === "immobilisation" ? "investissement" : rec?.nature === "financement" ? "financement" : "exploitation";
    flows.push({
      accountId: p.accountId,
      date: p.date,
      amount: incoming ? p.amount : -p.amount,
      kind,
      label: inv ? `${inv.party} — ${inv.description}` : rec?.label ?? p.note ?? "Paiement",
      sourceId: p.id,
    });
    if (p.fees) flows.push({ accountId: p.accountId, date: p.date, amount: -p.fees, kind: "exploitation", label: "Frais bancaires", sourceId: p.id });
  }
  for (const m of data.movements) {
    const label = m.description ?? m.type;
    switch (m.type) {
      case "apport":
      case "emprunt":
        flows.push({ accountId: m.accountId, date: m.date, amount: m.amount, kind: "financement", label, sourceId: m.id });
        break;
      case "retrait":
      case "remboursement_emprunt":
        flows.push({ accountId: m.accountId, date: m.date, amount: -m.amount, kind: "financement", label, sourceId: m.id });
        break;
      case "frais_bancaires":
      case "prelevement":
        flows.push({ accountId: m.accountId, date: m.date, amount: -m.amount, kind: "exploitation", label, sourceId: m.id });
        break;
      case "transfert":
        flows.push({ accountId: m.accountId, date: m.date, amount: -m.amount, kind: "interne", label, sourceId: m.id });
        if (m.toAccountId) {
          flows.push({ accountId: m.toAccountId, date: m.date, amount: m.toAmount ?? m.amount, kind: "interne", label, sourceId: m.id });
        }
        break;
    }
  }
  return flows;
}

/**
 * Solde d'un compte = solde initial à sa date de référence
 * + mouvements effectifs STRICTEMENT postérieurs à cette date (ceux d'avant sont déjà dans le solde).
 */
export function accountBalance(data: FinanceData, account: Account, asOf: ISODate, flows = cashFlows(data)): number {
  if (asOf < account.openingDate) return NaN;
  const moves = flows.filter((f) => f.accountId === account.id && f.date > account.openingDate && f.date <= asOf).map((f) => f.amount);
  return sumMoney([account.openingBalance, ...moves], account.currency);
}

export interface AccountPosition {
  account: Account;
  balance: number;
  /** Contre-valeur en devise principale, null si aucun taux n'est disponible. */
  baseValue: number | null;
  quote: RateQuote | null;
  lastUpdate: ISODate;
}

export interface CashPosition {
  accounts: AccountPosition[];
  /** Total consolidé, null si une contre-valeur manque (on n'additionne jamais des devises différentes). */
  total: number | null;
  /** Total limité aux comptes convertibles, pour information. */
  partialTotal: number;
  missingRates: string[];
  usesEstimatedRates: boolean;
  lastUpdate: ISODate;
}

export function cashPosition(data: FinanceData, asOf: ISODate): CashPosition {
  const base = data.settings.baseCurrency;
  const flows = cashFlows(data);
  const accounts = data.accounts
    .filter((a) => a.openingDate <= asOf)
    .map((account): AccountPosition => {
      const balance = accountBalance(data, account, asOf, flows);
      const conv = convert(balance, account.currency, base, data.rates, asOf);
      const dates = flows.filter((f) => f.accountId === account.id && f.date > account.openingDate && f.date <= asOf).map((f) => f.date);
      // Le solde de départ vaut pour le lendemain matin de sa date de référence.
      const lastUpdate = [addDays(account.openingDate, 1) > asOf ? asOf : addDays(account.openingDate, 1), ...dates].sort().at(-1)!;
      return { account, balance, baseValue: conv?.value ?? null, quote: conv?.quote ?? null, lastUpdate };
    });
  const missingRates = [...new Set(accounts.filter((a) => a.baseValue === null).map((a) => `${a.account.currency} → ${base}`))];
  const partialTotal = sumMoney(accounts.map((a) => a.baseValue ?? 0), base);
  return {
    accounts,
    total: missingRates.length ? null : partialTotal,
    partialTotal,
    missingRates,
    usesEstimatedRates: accounts.some((a) => a.quote && a.account.currency !== base),
    lastUpdate: accounts.map((a) => a.lastUpdate).sort().at(-1) ?? asOf,
  };
}

export interface CashFlowStatement {
  from: ISODate;
  to: ISODate;
  /** Encaissements réels (hors transferts internes), en devise principale. */
  inflows: number;
  outflows: number;
  net: number;
  byKind: Record<Exclude<FlowKind, "interne">, number>;
  openingBalance: number | null;
  closingBalance: number | null;
  /** Écart dû aux conversions et transferts entre devises : solde fin − solde début − variation. */
  conversionGap: number | null;
  missingRates: string[];
}

/** Flux de trésorerie réellement constatés sur une période (indépendant du résultat). */
export function cashFlowStatement(data: FinanceData, from: ISODate, to: ISODate): CashFlowStatement {
  const base = data.settings.baseCurrency;
  const accounts = new Map(data.accounts.map((a) => [a.id, a]));
  const missing = new Set<string>();
  const ins: number[] = [];
  const outs: number[] = [];
  const byKind = { exploitation: [] as number[], investissement: [] as number[], financement: [] as number[] };
  for (const f of cashFlows(data)) {
    const acc = accounts.get(f.accountId);
    if (!acc || f.kind === "interne" || f.date < from || f.date > to || f.date <= acc.openingDate) continue;
    const conv = convert(f.amount, acc.currency, base, data.rates, f.date);
    if (!conv) {
      missing.add(`${acc.currency} → ${base}`);
      continue;
    }
    (conv.value >= 0 ? ins : outs).push(conv.value);
    byKind[f.kind].push(conv.value);
  }
  const opening = cashPosition(data, addDays(from, -1));
  const closing = cashPosition(data, to);
  opening.missingRates.concat(closing.missingRates).forEach((m) => missing.add(m));
  const inflows = sumMoney(ins, base);
  const outflows = -sumMoney(outs, base);
  const net = roundMoney(inflows - outflows, base);
  const gap = opening.total !== null && closing.total !== null ? roundMoney(closing.total - opening.total - net, base) : null;
  return {
    from,
    to,
    inflows,
    outflows,
    net,
    byKind: {
      exploitation: sumMoney(byKind.exploitation, base),
      investissement: sumMoney(byKind.investissement, base),
      financement: sumMoney(byKind.financement, base),
    },
    openingBalance: opening.total,
    closingBalance: closing.total,
    conversionGap: gap,
    missingRates: [...missing],
  };
}
