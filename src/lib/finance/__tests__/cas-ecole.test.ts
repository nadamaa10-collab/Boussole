/**
 * Cas d'école « Studio Nour » (docs/CAS-ECOLE.md) : on rejoue la saisie exactement
 * comme dans l'interface, et on vérifie les montants annoncés à chaque étape.
 */
import { describe, expect, it } from "vitest";
import {
  budgetStatus,
  buildEmptyData,
  cashPosition,
  commitments,
  forecast,
  invoiceState,
  levySchedule,
  priorityActions,
  profitability,
  recordPayment,
  type FinanceData,
  type Invoice,
  type Recurrence,
} from "../index";

const T = "2026-11-24";

const sale = (o: Partial<Invoice> & Pick<Invoice, "id" | "party" | "description" | "amountHT" | "issueDate" | "dueDate">): Invoice => ({
  kind: "client",
  category: "Prestations",
  nature: "exploitation",
  currency: "MAD",
  vatAmount: 0,
  confidence: "probable",
  ...o,
});
const expense = (o: Partial<Invoice> & Pick<Invoice, "id" | "party" | "description" | "amountHT" | "issueDate" | "dueDate" | "category">): Invoice => ({
  kind: "fournisseur",
  nature: "exploitation",
  currency: "MAD",
  vatAmount: 0,
  ...o,
});
const rec = (o: Partial<Recurrence> & Pick<Recurrence, "id" | "label" | "amount" | "frequency" | "startDate" | "category">): Recurrence => ({
  kind: "depense",
  nature: "exploitation",
  currency: "MAD",
  accountId: "compte-1",
  essential: true,
  ...o,
});
const pay = (data: FinanceData, id: string, invoiceId: string, accountId: string, date: string, amount: number, settledAmount?: number) =>
  recordPayment(data, { id, invoiceId, accountId, date, amount, settledAmount }, T);
const cash = (d: FinanceData) => cashPosition(d, T).total;

export function buildCase() {
  // Étape 1 — configuration
  const s1 = buildEmptyData(
    {
      companyName: "Studio Nour",
      country: "Maroc",
      baseCurrency: "MAD",
      vatRegistered: false,
      accounts: [
        { name: "Banque pro", kind: "banque", currency: "MAD", balance: 20000, date: "2026-11-01" },
        { name: "Caisse", kind: "especes", currency: "MAD", balance: 800, date: "2026-11-01" },
      ],
    },
    T,
  );

  // Étape 2 — charges récurrentes, puis confirmation du loyer et d'Adobe (« Oui, c'est fait » = payé aujourd'hui)
  let s2: FinanceData = {
    ...s1,
    recurrences: [
      rec({ id: "r-loyer", label: "Loyer du bureau", amount: 3500, frequency: "mensuelle", startDate: "2026-11-05", category: "Loyer" }),
      rec({ id: "r-adobe", label: "Abonnement Adobe", amount: 600, frequency: "mensuelle", startDate: "2026-11-15", category: "Logiciels" }),
      rec({ id: "r-internet", label: "Internet et téléphone", amount: 400, frequency: "mensuelle", startDate: "2026-12-01", category: "Internet" }),
      rec({ id: "r-assur", label: "Assurance professionnelle", amount: 1800, frequency: "trimestrielle", startDate: "2026-12-10", category: "Assurance" }),
    ],
  };
  const s2before = s2;
  s2 = recordPayment(s2, { id: "p-loyer", recurrenceId: "r-loyer", occurrenceDate: "2026-11-05", accountId: "compte-1", date: T, amount: 3500 }, T);
  s2 = recordPayment(s2, { id: "p-adobe", recurrenceId: "r-adobe", occurrenceDate: "2026-11-15", accountId: "compte-1", date: T, amount: 600 }, T);

  // Étape 3 — ventes
  let s3: FinanceData = {
    ...s2,
    invoices: [
      sale({ id: "c1", party: "Café Atlas", description: "Logo et charte graphique", amountHT: 12000, issueDate: "2026-10-20", dueDate: "2026-11-19" }),
      sale({ id: "c2", party: "Hôtel Riad Bleu", description: "Brochure", amountHT: 8000, issueDate: "2026-11-03", dueDate: "2026-12-03" }),
      sale({ id: "c3", party: "Boutique Lina", description: "Site vitrine", amountHT: 15000, issueDate: "2026-11-10", dueDate: "2026-12-10", confidence: "incertain" }),
      sale({
        id: "c4",
        party: "Agence Lumière",
        description: "Affiches salon",
        amountHT: 1200,
        currency: "EUR",
        issueDate: "2026-11-12",
        dueDate: "2026-11-22",
        economicRate: { rate: 10.8, date: "2026-11-12", source: "Saisie manuelle", base: "MAD" },
      }),
      sale({ id: "c5", party: "Pâtisserie Amal", description: "Carte du menu", amountHT: 2500, issueDate: "2026-11-18", dueDate: "2026-11-18" }),
    ],
    rates: [...s2.rates, { from: "EUR", to: "MAD", rate: 10.8, date: "2026-11-12", source: "Saisie manuelle" }],
  };
  s3 = pay(s3, "p-c5", "c5", "compte-2", "2026-11-18", 2500); // « Déjà encaissée », en espèces
  s3 = pay(s3, "p-c2", "c2", "compte-1", "2026-11-15", 3000); // acompte
  s3 = pay(s3, "p-c4", "c4", "compte-1", "2026-11-21", 12800, 1200); // 1 200 € reçus en 12 800 DH

  // Étape 4 — dépenses
  let s4: FinanceData = {
    ...s3,
    invoices: [
      ...s3.invoices,
      expense({ id: "d1", party: "Imprimerie Al Amal", description: "Impression des brochures", amountHT: 2200, issueDate: "2026-11-08", dueDate: "2026-11-23", category: "Sous-traitance" }),
      expense({ id: "d2", party: "Info Plus", description: "Ordinateur portable", amountHT: 14000, issueDate: "2026-11-14", dueDate: "2026-11-14", category: "Matériel", nature: "immobilisation", usefulLifeMonths: 36 }),
      expense({ id: "d3", party: "Papeterie du Centre", description: "Fournitures de bureau", amountHT: 450, issueDate: "2026-11-06", dueDate: "2026-11-06", category: "Fournitures" }),
      expense({ id: "d4", party: "Yassine, photographe", description: "Shooting produits Boutique Lina", amountHT: 3000, issueDate: "2026-11-16", dueDate: "2026-12-16", category: "Sous-traitance" }),
      expense({ id: "d5", party: "ONCF et hôtel", description: "Déplacement à Marrakech", amountHT: 1350, issueDate: "2026-11-20", dueDate: "2026-11-20", category: "Déplacements" }),
      expense({ id: "d6", party: "Cabinet Benali", description: "Honoraires comptables", amountHT: 1500, issueDate: "2026-11-21", dueDate: "2026-12-05", category: "Honoraires" }),
    ],
  };
  s4 = pay(s4, "p-d2", "d2", "compte-1", "2026-11-14", 14000);
  s4 = pay(s4, "p-d3", "d3", "compte-2", "2026-11-06", 450);
  s4 = pay(s4, "p-d5", "d5", "compte-1", "2026-11-20", 1350);

  // Étape 5 — transfert banque → caisse
  const s5: FinanceData = { ...s4, movements: [{ id: "t1", type: "transfert", date: "2026-11-10", accountId: "compte-1", amount: 1000, toAccountId: "compte-2", toAmount: 1000 }] };

  // Étape 6 — budgets et cotisations
  const s6: FinanceData = {
    ...s5,
    budgets: [
      { category: "Logiciels", monthly: 500 },
      { category: "Fournitures", monthly: 400 },
      { category: "Déplacements", monthly: 1500 },
      { category: "Sous-traitance", monthly: 6000 },
    ],
    settings: { ...s5.settings, levies: [{ label: "Impôt et cotisations (taux d'exercice)", rate: 0.02, base: "chiffre_affaires", validFrom: "2026-01-01", source: "Taux d'exercice, à remplacer par le vôtre" }] },
  };

  // Étape 8 — corrections
  let s8: FinanceData = { ...s6, invoices: s6.invoices.map((i) => (i.id === "d6" ? { ...i, amountHT: 1800 } : i)) };
  s8 = pay(s8, "p-d1", "d1", "compte-1", T, 1000); // acompte à l'imprimerie

  return { s1, s2before, s2, s3, s4, s5, s6, s8 };
}

describe("Cas d'école Studio Nour", () => {
  const c = buildCase();
  const nov = ["2026-11-01", "2026-11-30"] as const;

  it("étape 1 : argent disponible de départ", () => {
    expect(cash(c.s1)).toBe(20800);
  });

  it("étape 2 : charges à confirmer, puis confirmées", () => {
    const todo = priorityActions(c.s2before, T).filter((a) => a.kind === "charge_a_confirmer").map((a) => a.title);
    expect(todo).toEqual(["Loyer du bureau : payé ?", "Abonnement Adobe : payé ?"]);
    expect(cash(c.s2before)).toBe(20800);
    expect(cash(c.s2)).toBe(16700);
  });

  it("étape 3 : ventes", () => {
    expect(cash(c.s3)).toBe(35000);
    const st = (id: string) => invoiceState(c.s3.invoices.find((i) => i.id === id)!, c.s3.payments, T);
    expect(st("c1").label).toBe("Impayée — en retard de 5 jours");
    expect(st("c2").remaining).toBe(5000);
    expect(st("c4").settlement).toBe("payee");
    expect(commitments(c.s3, T).receivables.total).toBe(32000);
  });

  it("étape 4 et 5 : dépenses et transfert", () => {
    expect(cash(c.s4)).toBe(19200);
    expect(cash(c.s5)).toBe(19200);
    expect(cashPosition(c.s5, T).accounts.map((a) => a.balance)).toEqual([15350, 3850]);
    expect(commitments(c.s5, T).payables.total).toBe(6700);
  });

  it("étape 7 : lecture des tableaux", () => {
    const p = profitability(c.s6, ...nov);
    expect(p.revenue).toBe(38460);
    expect(p.charges).toBe(12988.89);
    expect(p.operatingResult).toBe(25471.11);
    expect(p.fxResult).toBe(-160);
    expect(p.levies?.[0]?.amount).toBe(769.2);
    expect(p.resultAfterLevies).toBe(24541.91);

    const f30 = forecast(c.s6, { today: T, days: 30 });
    expect(f30.totals).toEqual({ inflows: 32000, outflows: 13000 });
    expect(f30.end).toBe(38200);
    // Le point le plus bas part de l'argent disponible ce matin (Café Atlas, en retard, n'est pas garanti).
    expect(f30.min).toEqual({ date: T, balance: 19200 });
    expect(f30.firstNegative).toBeNull();

    const prudent = forecast(c.s6, { today: T, days: 30, scenario: "prudent" });
    expect(prudent.min).toEqual({ date: "2026-12-16", balance: 11200 });
    expect(prudent.end).toBe(23200);

    // Simulation : achat d'une imprimante à 20 000 DH le 2 décembre, en scénario prudent.
    const sim = forecast(c.s6, { today: T, days: 30, scenario: "prudent", simulations: [{ date: "2026-12-02", label: "Imprimante", amount: -20000 }] });
    expect(sim.firstNegative).toEqual({ date: "2026-12-02", balance: -3400 });
    expect(sim.min).toEqual({ date: "2026-12-16", balance: -8800 });
    expect(sim.end).toBe(3200);

    // Cotisations trimestrielles : 2 % du CA du 4e trimestre (octobre + novembre saisis), payables fin janvier.
    const due = levySchedule(c.s6, T, "2027-03-31", T);
    expect(due.map((d) => [d.period, d.dueDate, d.amount, d.provisional])).toEqual([["2026-T4", "2027-01-31", 1009.2, true]]);
    expect(forecast(c.s6, { today: T, days: 90 }).end).toBe(28190.8);

    const b = Object.fromEntries(budgetStatus(c.s6, "2026-11").map((x) => [x.category, [x.percent, x.level]]));
    expect(b).toEqual({ Logiciels: [120, "depasse"], Fournitures: [113, "depasse"], Déplacements: [90, "alerte"], "Sous-traitance": [87, "alerte"] });
  });

  it("étape 8 : corrections", () => {
    expect(commitments(c.s8, T).payables.total).toBe(6000);
    expect(cash(c.s8)).toBe(18200);
    expect(invoiceState(c.s8.invoices.find((i) => i.id === "d1")!, c.s8.payments, T).label).toBe("Paiement partiel en retard — 1 200,00 MAD restants");
  });
});
