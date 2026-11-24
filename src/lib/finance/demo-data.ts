import { addDays, addMonths, type ISODate } from "./dates";
import type { CurrencyCode } from "./money";
import type { FinanceData, FxRate } from "./types";

/**
 * Taux FICTIFS, uniquement pour la démo. Ils sont marqués `demo: true`
 * et affichés « Taux de démonstration (fictifs) » dans l'interface.
 */
const DEMO_PER_EUR: Record<CurrencyCode, number> = {
  EUR: 1,
  USD: 1.087,
  MAD: 10.8,
  GBP: 0.85,
  CHF: 0.95,
  CAD: 1.5,
  XOF: 655.957,
  TND: 3.4,
};

export const DEMO_CURRENCIES = Object.keys(DEMO_PER_EUR);

export function demoRates(date: ISODate): FxRate[] {
  const rates: FxRate[] = [];
  for (const from of DEMO_CURRENCIES) {
    for (const to of DEMO_CURRENCIES) {
      if (from === to) continue;
      rates.push({ from, to, rate: DEMO_PER_EUR[to]! / DEMO_PER_EUR[from]!, date, source: "Taux de démonstration (fictifs)", demo: true });
    }
  }
  return rates;
}

/**
 * Atelier fictif, construit autour de la date du jour pour rester toujours d'actualité.
 * Il illustre : paiements partiels, facture en retard, facture en dollars, récurrences,
 * dépense exceptionnelle, et un passage à découvert malgré un mois rentable.
 */
export function buildDemoData(today: ISODate): FinanceData {
  const d = (n: number) => addDays(today, n);
  const opening = d(-60);
  const rent = addMonths(d(4), -3);
  const software = addMonths(d(9), -3);
  const insurance = addMonths(d(20), -3);

  return {
    demo: true,
    settings: {
      companyName: "Atelier Lumen (démo)",
      country: "France",
      baseCurrency: "EUR",
      locale: "fr-FR",
      legalStatus: "Entrepreneur individuel",
      vatRegistered: false,
      fiscalYearStartMonth: 1,
      levies: [{ label: "Cotisations sociales (hypothèse de démo)", rate: 0.22, base: "chiffre_affaires", validFrom: d(-365), source: "Taux fictif de démonstration — à remplacer par votre taux réel" }],
      budgetThresholds: { warning: 0.8, over: 1 },
      inactiveMonths: [],
      incompleteMonths: [],
      targetMonthlyPay: 2500,
      variableCostRate: 0.1,
      cashReserveTarget: 6000,
      monthlyRevenueTarget: 7000,
    },
    accounts: [
      { id: "pro", name: "Compte pro", kind: "banque", currency: "EUR", openingBalance: 3000, openingDate: opening, source: "manuel" },
      { id: "usd", name: "Compte en dollars", kind: "banque", currency: "USD", openingBalance: 400, openingDate: opening, source: "manuel" },
      { id: "caisse", name: "Caisse", kind: "especes", currency: "EUR", openingBalance: 150, openingDate: opening, source: "manuel" },
    ],
    invoices: [
      { id: "f-nord", kind: "client", party: "Studio Nord", reference: "F-101", description: "Site vitrine", category: "Création web", nature: "exploitation", currency: "EUR", amountHT: 4000, vatAmount: 0, issueDate: d(-50), dueDate: d(-20) },
      { id: "f-lea", kind: "client", party: "Léa Martin", reference: "F-102", description: "Identité visuelle", category: "Design", nature: "exploitation", currency: "EUR", amountHT: 1200, vatAmount: 0, issueDate: d(-45), dueDate: d(-15) },
      { id: "f-bright-1", kind: "client", party: "Brightline Inc.", reference: "F-103", description: "Bannières campagne", category: "Design", nature: "exploitation", currency: "USD", amountHT: 1000, vatAmount: 0, issueDate: d(-40), dueDate: d(-25) },
      { id: "f-arlo", kind: "client", party: "Maison Arlo", reference: "F-104", description: "Refonte du catalogue", category: "Design", nature: "exploitation", currency: "EUR", amountHT: 6000, vatAmount: 0, issueDate: d(-20), dueDate: d(10), expectedPaymentDate: d(12), confidence: "probable" },
      { id: "f-bright-2", kind: "client", party: "Brightline Inc.", reference: "F-105", description: "Landing page produit", category: "Création web", nature: "exploitation", currency: "USD", amountHT: 2500, vatAmount: 0, issueDate: d(-10), dueDate: d(20), confidence: "incertain" },
      { id: "f-sol", kind: "client", party: "Café Sol", reference: "F-106", description: "Accompagnement réseaux sociaux (3 mois)", category: "Conseil", nature: "exploitation", currency: "EUR", amountHT: 3600, vatAmount: 0, issueDate: d(-15), dueDate: d(25), servicePeriod: { start: d(-15), end: d(74) } },
      { id: "a-compta", kind: "fournisseur", party: "Cabinet Verne", description: "Bilan annuel", category: "Honoraires", nature: "exploitation", currency: "EUR", amountHT: 600, vatAmount: 0, issueDate: d(-30), dueDate: d(-1) },
      { id: "a-duval", kind: "fournisseur", party: "Imprimerie Duval", description: "Impressions catalogue", category: "Sous-traitance", nature: "exploitation", currency: "EUR", amountHT: 900, vatAmount: 0, issueDate: d(-12), dueDate: d(3) },
      { id: "a-ordi", kind: "fournisseur", party: "TechPro", description: "Ordinateur portable", category: "Matériel", nature: "immobilisation", usefulLifeMonths: 36, currency: "EUR", amountHT: 2400, vatAmount: 0, issueDate: d(-8), dueDate: d(6), notes: "Dépense exceptionnelle" },
    ],
    payments: [
      { id: "p-nord", invoiceId: "f-nord", accountId: "pro", date: d(-22), amount: 4000 },
      // 1 000 USD facturés (920 € au taux de facture), 905 € reçus : −15 € d'écart de change.
      { id: "p-bright-1", invoiceId: "f-bright-1", accountId: "pro", date: d(-25), amount: 905, settledAmount: 1000 },
      { id: "p-arlo-1", invoiceId: "f-arlo", accountId: "pro", date: d(-5), amount: 2000 },
      { id: "p-compta", invoiceId: "a-compta", accountId: "pro", date: d(-2), amount: 600 },
      ...[1, 2, 3].map((k) => ({ id: `p-loyer-${k}`, recurrenceId: "r-loyer", occurrenceDate: addMonths(rent, k - 1), accountId: "pro", date: addMonths(rent, k - 1), amount: 1400 })),
      ...[1, 2, 3].map((k) => ({ id: `p-logi-${k}`, recurrenceId: "r-logiciels", occurrenceDate: addMonths(software, k - 1), accountId: "pro", date: addMonths(software, k - 1), amount: 89 })),
      { id: "p-assur-1", recurrenceId: "r-assurance", occurrenceDate: insurance, accountId: "pro", date: insurance, amount: 480 },
    ],
    movements: [
      { id: "m-retrait", type: "retrait", date: d(-15), accountId: "pro", amount: 3800, description: "Rémunération de l'entrepreneur" },
      { id: "m-transfert", type: "transfert", date: d(-30), accountId: "usd", amount: 300, toAccountId: "pro", toAmount: 270, description: "Rapatriement de dollars" },
      { id: "m-frais", type: "frais_bancaires", date: d(-28), accountId: "pro", amount: 12, description: "Frais de tenue de compte" },
    ],
    recurrences: [
      { id: "r-loyer", kind: "depense", label: "Loyer de l'atelier", category: "Loyer", nature: "exploitation", amount: 1400, currency: "EUR", frequency: "mensuelle", startDate: rent, accountId: "pro", essential: true },
      { id: "r-logiciels", kind: "depense", label: "Abonnements logiciels", category: "Logiciels", nature: "exploitation", amount: 89, currency: "EUR", frequency: "mensuelle", startDate: software, accountId: "pro", essential: true },
      { id: "r-assurance", kind: "depense", label: "Assurance professionnelle", category: "Assurance", nature: "exploitation", amount: 480, currency: "EUR", frequency: "trimestrielle", startDate: insurance, accountId: "pro", essential: true },
    ],
    rates: demoRates(d(-400)),
    budgets: [
      { category: "Loyer", monthly: 1400 },
      { category: "Logiciels", monthly: 80 },
      { category: "Sous-traitance", monthly: 1000 },
      { category: "Honoraires", monthly: 700 },
    ],
  };
}
