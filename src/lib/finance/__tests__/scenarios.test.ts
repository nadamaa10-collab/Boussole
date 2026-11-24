import { describe, expect, it } from "vitest";
import {
  addDays,
  applyBaseCurrencyChange,
  breakEven,
  buildDemoData,
  buildEmptyData,
  migrateData,
  recordPayment as record,
  cashFlowStatement,
  cashPosition,
  commitments,
  forecast,
  forecastSteps,
  invoiceState,
  monthlyRevenueStats,
  overrideOccurrence,
  previewBaseCurrencyChange,
  profitability,
  recordPayment,
  runway,
  validatePayment,
  type FinanceData,
  type Invoice,
} from "../index";

const T = "2026-11-24";
const d = (n: number) => addDays(T, n);

function base(over: Partial<FinanceData> = {}): FinanceData {
  return {
    settings: {
      companyName: "Test",
      baseCurrency: "EUR",
      locale: "fr-FR",
      vatRegistered: false,
      fiscalYearStartMonth: 1,
      levies: [],
      budgetThresholds: { warning: 0.8, over: 1 },
      inactiveMonths: [],
      incompleteMonths: [],
    },
    accounts: [{ id: "a", name: "Banque", kind: "banque", currency: "EUR", openingBalance: 5000, openingDate: d(-60), source: "manuel" }],
    invoices: [],
    payments: [],
    movements: [],
    recurrences: [],
    rates: [],
    budgets: [],
    ...over,
  };
}

function inv(o: Partial<Invoice> & Pick<Invoice, "id">): Invoice {
  return {
    kind: "client",
    party: "Client",
    description: "Prestation",
    category: "Ventes",
    nature: "exploitation",
    currency: "EUR",
    amountHT: 10000,
    vatAmount: 0,
    issueDate: d(-10),
    dueDate: d(20),
    ...o,
  };
}

const sp = (s: string | null) => (s ?? "").replace(/\s/g, " ");
const cash = (data: FinanceData, at = T) => cashPosition(data, at).total;
const usd = (over: Partial<FinanceData> = {}) =>
  base({
    rates: [
      { from: "USD", to: "EUR", rate: 0.92, date: d(-30), source: "Saisie manuelle" },
      { from: "USD", to: "EUR", rate: 0.9, date: d(-5), source: "Saisie manuelle" },
    ],
    ...over,
  });

const month = { from: "2026-11-01", to: "2026-11-30" };

describe("Exemple du cahier des charges — trésorerie chronologique", () => {
  it("affiche les fluctuations jour par jour, pas seulement le solde final", () => {
    const data = base({
      invoices: [
        inv({ id: "fourn", kind: "fournisseur", amountHT: 2000, dueDate: "2026-11-26" }),
        inv({ id: "c1", amountHT: 4000, dueDate: "2026-11-30" }),
        inv({ id: "loyer", kind: "fournisseur", amountHT: 3000, dueDate: "2026-12-03" }),
        inv({ id: "c2", amountHT: 6000, dueDate: "2026-12-10" }),
      ],
    });
    const f = forecast(data, { today: T, days: 30 });
    expect(forecastSteps(f).map((p) => [p.date, p.balance])).toEqual([
      [T, 5000],
      ["2026-11-26", 3000],
      ["2026-11-30", 7000],
      ["2026-12-03", 4000],
      ["2026-12-10", 10000],
    ]);
    expect(f.min).toEqual({ date: "2026-11-26", balance: 3000 });
  });
});

describe("Les 21 cas obligatoires", () => {
  it("1. facture créée mais non payée : CA reconnu, trésorerie inchangée, à encaisser", () => {
    const data = base({ invoices: [inv({ id: "f" })] });
    expect(invoiceState(data.invoices[0]!, [], T).settlement).toBe("non_payee");
    expect(profitability(data, month.from, month.to).revenue).toBe(10000);
    expect(cash(data)).toBe(5000);
    expect(commitments(data, T).receivables.total).toBe(10000);
  });

  it("2. facture payée intégralement : disparaît des montants à encaisser, CA non doublé", () => {
    let data = base({ invoices: [inv({ id: "f" })] });
    data = recordPayment(data, { id: "p", invoiceId: "f", accountId: "a", date: d(-1), amount: 10000 }, T);
    const st = invoiceState(data.invoices[0]!, data.payments, T);
    expect(st.settlement).toBe("payee");
    expect(st.label).toMatch(/^Payée — le/);
    expect(commitments(data, T).receivables.total).toBe(0);
    expect(profitability(data, month.from, month.to).revenue).toBe(10000);
    expect(cash(data)).toBe(15000);
  });

  it("3. facture payée en plusieurs fois (10 000 → 3 000 + 4 000)", () => {
    let data = base({ invoices: [inv({ id: "f", currency: "EUR", issueDate: d(-30) })] });
    data = recordPayment(data, { id: "p1", invoiceId: "f", accountId: "a", date: d(-19), amount: 3000 }, T);
    data = recordPayment(data, { id: "p2", invoiceId: "f", accountId: "a", date: d(-9), amount: 4000 }, T);
    const st = invoiceState(data.invoices[0]!, data.payments, T);
    expect([st.total, st.paid, st.remaining, st.settlement]).toEqual([10000, 7000, 3000, "partielle"]);
    expect(commitments(data, T).receivables.total).toBe(3000);
    expect(profitability(data, d(-30), T).revenue).toBe(10000);
  });

  it("4. paiement partiel ET en retard : les deux statuts coexistent", () => {
    const data = base({ invoices: [inv({ id: "f", dueDate: d(-5) })], payments: [{ id: "p", invoiceId: "f", accountId: "a", date: d(-6), amount: 8000 }] });
    const st = invoiceState(data.invoices[0]!, data.payments, T);
    expect(st.settlement).toBe("partielle");
    expect(st.due).toBe("en_retard");
    expect(sp(st.label)).toBe("Paiement partiel en retard — 2 000,00 € restants");
  });

  it("5. paiement reçu avant l'échéance : payée, jamais en retard", () => {
    const data = base({ invoices: [inv({ id: "f", dueDate: d(30) })], payments: [{ id: "p", invoiceId: "f", accountId: "a", date: d(-1), amount: 10000 }] });
    const st = invoiceState(data.invoices[0]!, data.payments, T);
    expect(st.settlement).toBe("payee");
    expect(st.due).toBeNull();
    expect(forecast(data, { today: T, days: 60 }).events).toHaveLength(0);
  });

  it("6. paiement antidaté : compté à sa date réelle ; avant le solde de départ, il n'est pas recompté", () => {
    const data = base({ invoices: [inv({ id: "f", issueDate: d(-90) })] });
    const late = recordPayment(data, { id: "p", invoiceId: "f", accountId: "a", date: d(-20), amount: 1000 }, T);
    expect(cash(late, d(-21))).toBe(5000);
    expect(cash(late)).toBe(6000);
    const beforeOpening = { id: "p0", invoiceId: "f", accountId: "a", date: d(-70), amount: 1000 };
    expect(validatePayment(data, beforeOpening, T).warnings[0]).toMatch(/déjà inclus/);
    expect(cash(recordPayment(data, beforeOpening, T))).toBe(5000);
    expect(validatePayment(data, { ...beforeOpening, date: d(1) }, T).errors[0]).toMatch(/futur/);
  });

  it("7. facture annulée, puis remboursement d'une facture payée", () => {
    const cancelled = base({ invoices: [inv({ id: "f", cancelled: true })] });
    expect(profitability(cancelled, month.from, month.to).revenue).toBe(0);
    expect(commitments(cancelled, T).receivables.total).toBe(0);

    let data = base({ invoices: [inv({ id: "f" })], payments: [{ id: "p", invoiceId: "f", accountId: "a", date: d(-3), amount: 10000 }] });
    data = recordPayment(data, { id: "r", invoiceId: "f", accountId: "a", date: d(-1), amount: -2000 }, T);
    expect(invoiceState(data.invoices[0]!, data.payments, T).remaining).toBe(2000);
    expect(cash(data)).toBe(13000);
    expect(validatePayment(data, { id: "r2", invoiceId: "f", accountId: "a", date: T, amount: -9000 }, T).errors).toHaveLength(1);
  });

  it("8. transfert entre comptes : ni revenu ni dépense, total inchangé", () => {
    const data = base({
      accounts: [...base().accounts, { id: "b", name: "Épargne", kind: "banque", currency: "EUR", openingBalance: 0, openingDate: d(-60), source: "manuel" }],
      movements: [{ id: "t", type: "transfert", date: d(-5), accountId: "a", amount: 2000, toAccountId: "b" }],
    });
    const pos = cashPosition(data, T);
    expect(pos.accounts.map((x) => x.balance)).toEqual([3000, 2000]);
    expect(pos.total).toBe(5000);
    const p = profitability(data, month.from, month.to);
    expect([p.revenue, p.charges]).toEqual([0, 0]);
    expect(cashFlowStatement(data, month.from, month.to).net).toBe(0);
  });

  it("9. apport personnel : trésorerie +, chiffre d'affaires inchangé", () => {
    const data = base({ movements: [{ id: "m", type: "apport", date: d(-2), accountId: "a", amount: 3000 }] });
    expect(cash(data)).toBe(8000);
    expect(profitability(data, month.from, month.to).revenue).toBe(0);
    expect(cashFlowStatement(data, month.from, month.to).byKind.financement).toBe(3000);
  });

  it("10. remboursement d'emprunt : seuls les intérêts sont une charge", () => {
    const data = base({
      movements: [
        { id: "e", type: "emprunt", date: d(-50), accountId: "a", amount: 10000 },
        { id: "r", type: "remboursement_emprunt", date: d(-3), accountId: "a", amount: 900, interestPart: 100 },
      ],
    });
    const p = profitability(data, month.from, month.to);
    expect(p.charges).toBe(0);
    expect(p.interest).toBe(100);
    expect(p.resultBeforeLevies).toBe(-100);
    expect(cash(data)).toBe(14100);
  });

  it("11. dépense récurrente non payée : prévue en trésorerie, pas déduite du solde", () => {
    const data = base({
      recurrences: [{ id: "r", kind: "depense", label: "Loyer", category: "Loyer", nature: "exploitation", amount: 1000, currency: "EUR", frequency: "mensuelle", startDate: d(5), accountId: "a", essential: true }],
    });
    expect(cash(data)).toBe(5000);
    const f = forecast(data, { today: T, days: 40 });
    expect(f.events.map((e) => [e.date, e.amount])).toEqual([["2026-11-29", -1000], ["2026-12-29", -1000]]);
    // Modification ponctuelle d'une occurrence : la série n'est pas touchée.
    const moved = { ...data, recurrences: [overrideOccurrence(data.recurrences[0]!, d(5), { amount: 1200 })] };
    expect(forecast(moved, { today: T, days: 40 }).events.map((e) => e.amount)).toEqual([-1200, -1000]);
    // Confirmée par un paiement, elle quitte les prévisions et entre dans le solde.
    const paid = { ...data, payments: [{ id: "p", recurrenceId: "r", occurrenceDate: d(5), accountId: "a", date: T, amount: 1000 }] };
    expect(forecast(paid, { today: T, days: 40 }).events).toHaveLength(1);
    expect(cash(paid)).toBe(4000);
  });

  it("12. modification d'une date d'échéance : la prévision suit", () => {
    const data = base({ invoices: [inv({ id: "f", amountHT: 6000, dueDate: d(10) })] });
    expect(forecast(data, { today: T, days: 30 }).events[0]!.date).toBe(d(10));
    const moved = { ...data, invoices: [{ ...data.invoices[0]!, dueDate: d(25) }] };
    expect(forecast(moved, { today: T, days: 30 }).events[0]!.date).toBe(d(25));
    expect(forecast(moved, { today: T, days: 20 }).events).toHaveLength(0);
  });

  it("13. mois sans données : exclus de la moyenne, pas comptés comme zéro", () => {
    const data = base({
      invoices: [inv({ id: "s", issueDate: "2026-08-10", amountHT: 3000 }), inv({ id: "o", issueDate: "2026-10-10", amountHT: 5000 })],
      settings: { ...base().settings, inactiveMonths: ["2026-07"] },
    });
    const s = monthlyRevenueStats(data, "2026-06-01", T);
    expect(s.months.map((m) => m.status)).toEqual(["sans_donnees", "sans_activite", "complet", "sans_donnees", "complet", "sans_donnees"]);
    expect(s.monthsUsed).toBe(3);
    expect(s.averageRevenue).toBeCloseTo(8000 / 3, 2);
  });

  it("14. trésorerie prévisionnelle négative : date, minimum et alerte explicites", () => {
    const data = base({
      invoices: [inv({ id: "loyer", kind: "fournisseur", party: "Bailleur", amountHT: 6200, dueDate: d(5) }), inv({ id: "c", party: "Studio Nord", amountHT: 4000, dueDate: d(12) })],
    });
    const f = forecast(data, { today: T, days: 30 });
    expect(f.firstNegative).toEqual({ date: d(5), balance: -1200 });
    expect(sp(f.alert)).toMatch(/pourrait atteindre -1 200,00 € le .* avant l'encaissement prévu de Studio Nord/);
  });

  it("15. changement de statut d'une facture au fil du temps", () => {
    const f = inv({ id: "f", dueDate: d(0) });
    const pays = [{ id: "p", invoiceId: "f", accountId: "a", date: d(3), amount: 10000 }];
    expect(invoiceState(f, pays, d(-1)).due).toBe("a_venir");
    expect(invoiceState(f, pays, T).due).toBe("aujourdhui");
    expect(invoiceState(f, pays, d(2)).due).toBe("en_retard");
    expect(invoiceState(f, pays, d(3)).settlement).toBe("payee");
  });

  it("16. facture en devise étrangère : montant d'origine conservé, contre-valeur estimée", () => {
    const data = usd({ invoices: [inv({ id: "f", currency: "USD", amountHT: 1000, issueDate: d(-20) })] });
    expect(profitability(data, month.from, month.to).revenue).toBe(920); // taux de la date de facture
    const r = commitments(data, T).receivables.items[0]!;
    expect([r.remaining, r.currency, r.baseValue, r.estimatedFx]).toEqual([1000, "USD", 900, true]); // taux du jour
    expect(validatePayment(data, { id: "p", invoiceId: "f", accountId: "a", date: T, amount: 450 }, T).errors[0]).toMatch(/montant soldé en USD/);
  });

  it("17. paiement partiel avec conversion de devise", () => {
    let data = usd({ invoices: [inv({ id: "f", currency: "USD", amountHT: 1000, issueDate: d(-20) })] });
    data = recordPayment(data, { id: "p", invoiceId: "f", accountId: "a", date: d(-2), amount: 450, settledAmount: 500 }, T);
    const st = invoiceState(data.invoices[0]!, data.payments, T);
    expect([st.paid, st.remaining, st.settlement]).toEqual([500, 500, "partielle"]);
    expect(cash(data)).toBe(5450);
    expect(profitability(data, month.from, month.to).fxResult).toBe(-10); // 450 reçus vs 460 au taux de facture
  });

  it("18. variation de change entre facturation et paiement : le CA initial n'est pas réécrit", () => {
    let data = usd({ invoices: [inv({ id: "f", currency: "USD", amountHT: 1000, issueDate: d(-20) })] });
    data = recordPayment(data, { id: "p", invoiceId: "f", accountId: "a", date: d(-1), amount: 905, settledAmount: 1000 }, T);
    const p = profitability(data, month.from, month.to);
    expect(p.revenue).toBe(920);
    expect(p.fxResult).toBe(-15);
    expect(p.resultBeforeLevies).toBe(905);
    expect(p.resultLabel).toBe("Résultat estimé avant prélèvements");
  });

  it("19. transfert entre deux comptes de devises différentes", () => {
    const data = usd({
      accounts: [...base().accounts, { id: "u", name: "USD", kind: "banque", currency: "USD", openingBalance: 1000, openingDate: d(-60), source: "manuel" }],
      movements: [{ id: "t", type: "transfert", date: d(-1), accountId: "u", amount: 500, toAccountId: "a", toAmount: 445 }],
    });
    const pos = cashPosition(data, T);
    expect(pos.accounts.map((x) => [x.account.currency, x.balance])).toEqual([["EUR", 5445], ["USD", 500]]);
    expect(pos.total).toBe(5895);
    const p = profitability(data, month.from, month.to);
    expect([p.revenue, p.charges]).toEqual([0, 0]);
  });

  it("20. changement de devise principale : aperçu, confirmation, historique conservé", () => {
    const data = usd({
      rates: [...usd().rates, { from: "EUR", to: "MAD", rate: 10.8, date: d(-90), source: "Saisie manuelle" }, { from: "USD", to: "MAD", rate: 9.9, date: d(-90), source: "Saisie manuelle" }],
      invoices: [inv({ id: "f", currency: "USD", amountHT: 1000, issueDate: d(-20) }), inv({ id: "g", amountHT: 2000, issueDate: d(-20) })],
      budgets: [{ category: "Loyer", monthly: 1000 }],
    });
    const preview = previewBaseCurrencyChange(data, "MAD", T);
    expect(preview.canApply).toBe(true);
    expect(() => applyBaseCurrencyChange(data, preview, false)).toThrow(/confirmé/);
    const next = applyBaseCurrencyChange(data, preview, true);
    expect(next.settings.baseCurrency).toBe("MAD");
    expect(next.invoices.map((i) => [i.currency, i.amountHT])).toEqual([["USD", 1000], ["EUR", 2000]]);
    expect(next.invoices[0]!.economicRateHistory?.[0]).toMatchObject({ rate: 0.92, base: "EUR" });
    expect(profitability(next, month.from, month.to).revenue).toBe(9900 + 21600);
    expect(next.budgets[0]!.monthly).toBe(10800);
    expect(previewBaseCurrencyChange(data, "CHF", T).missingRates.length).toBeGreaterThan(0);
  });

  it("21. consolidation de comptes en devises différentes, jamais additionnés bruts", () => {
    const data = usd({
      accounts: [
        ...base().accounts,
        { id: "u", name: "USD", kind: "banque", currency: "USD", openingBalance: 1000, openingDate: d(-60), source: "manuel" },
        { id: "m", name: "Caisse", kind: "especes", currency: "MAD", openingBalance: 500, openingDate: d(-60), source: "manuel" },
      ],
    });
    const missing = cashPosition(data, T);
    expect(missing.total).toBeNull();
    expect(missing.missingRates).toEqual(["MAD → EUR"]);
    expect(forecast(data, { today: T, days: 7 }).available).toBe(false);
    const ok = { ...data, rates: [...data.rates, { from: "EUR", to: "MAD", rate: 10, date: d(-10), source: "Saisie manuelle" }] };
    expect(cashPosition(ok, T).total).toBe(5000 + 900 + 50);
  });
});

describe("Garde-fous complémentaires", () => {
  it("refuse un paiement supérieur au reste dû, sauf trop-perçu confirmé", () => {
    const data = base({ invoices: [inv({ id: "f", amountHT: 1000 })] });
    const p = { id: "p", invoiceId: "f", accountId: "a", date: T, amount: 1200 };
    expect(() => recordPayment(data, p, T)).toThrow(/dépasse le reste dû/);
    const ok = recordPayment(data, p, T, { allowOverpayment: true });
    expect(invoiceState(ok.invoices[0]!, ok.payments, T).overpaid).toBe(200);
  });

  it("prestation sur plusieurs mois : revenu réparti au prorata", () => {
    const data = base({ invoices: [inv({ id: "f", amountHT: 3000, servicePeriod: { start: "2026-11-01", end: "2027-01-29" } })] });
    expect(profitability(data, "2026-11-01", "2026-11-30").revenue).toBe(1000);
  });

  it("immobilisation : décaissement immédiat, charge étalée en amortissement", () => {
    const data = base({
      invoices: [inv({ id: "o", kind: "fournisseur", nature: "immobilisation", usefulLifeMonths: 36, amountHT: 3600, issueDate: "2026-11-05" })],
      payments: [{ id: "p", invoiceId: "o", accountId: "a", date: d(-1), amount: 3600 }],
    });
    expect(profitability(data, month.from, month.to).charges).toBe(100);
    expect(cashFlowStatement(data, month.from, month.to).byKind.investissement).toBe(-3600);
  });

  it("prélèvements : jamais devinés, appliqués seulement s'ils sont configurés", () => {
    const data = base({ invoices: [inv({ id: "f", amountHT: 5000 })] });
    expect(profitability(data, month.from, month.to).resultAfterLevies).toBeNull();
    const withLevy = { ...data, settings: { ...data.settings, levies: [{ label: "Cotisations", rate: 0.2, base: "chiffre_affaires" as const, validFrom: "2026-01-01", source: "test" }] } };
    const p = profitability(withLevy, month.from, month.to);
    expect([p.resultAfterLevies, p.resultLabel]).toEqual([4000, "Résultat estimé après prélèvements"]);
  });

  it("scénario prudent : décale les encaissements incertains sans inventer de probabilité", () => {
    const data = base({ invoices: [inv({ id: "f", amountHT: 2000, dueDate: d(5), confidence: "incertain" })] });
    expect(forecast(data, { today: T, days: 60 }).events[0]!.date).toBe(d(5));
    const prudent = forecast(data, { today: T, days: 60, scenario: "prudent", prudentDelayDays: 30 });
    expect([prudent.events[0]!.date, prudent.events[0]!.shifted]).toEqual([d(35), true]);
  });

  it("taux de simulation : contre-valeur modifiable et signalée comme estimative", () => {
    const data = usd({ invoices: [inv({ id: "f", currency: "USD", amountHT: 1000, dueDate: d(5) })] });
    const e = forecast(data, { today: T, days: 30, fxOverrides: { USD: 0.8 } }).events[0]!;
    expect([e.amount, e.estimatedFx]).toEqual([800, true]);
  });

  it("autonomie et CA minimum : non affichés sans données suffisantes", () => {
    const data = base();
    expect(runway(data, T).incompressible.months).toBeNull();
    expect(runway(data, T).habituelles.months).toBeNull();
    expect(breakEven(data, T).value).toBeNull();
    expect(breakEven(data, T, { fixedMonthly: 2000, variableRate: 0.1, targetPay: 1800 }).value).toBe(4222.22);
  });
});

describe("Démo", () => {
  const demo = buildDemoData(T);

  it("est rentable mais passe temporairement à découvert", () => {
    const p = profitability(demo, "2026-11-01", "2026-11-30");
    expect(p.operatingResult).toBeGreaterThan(0);
    const f = forecast(demo, { today: T, days: 30 });
    expect(f.firstNegative).not.toBeNull();
    expect(f.end).toBeGreaterThan(0);
  });

  it("change de devise de façon cohérente (pas un simple changement de symbole)", () => {
    const preview = previewBaseCurrencyChange(demo, "MAD", T);
    expect(preview.canApply).toBe(true);
    const mad = applyBaseCurrencyChange(demo, preview, true);
    const eur = cashPosition(demo, T).total!;
    expect(cashPosition(mad, T).total).toBeCloseTo(eur * 10.8, 0);
  });
});

describe("Démarrage à vide", () => {
  it("ne contient aucune donnée fictive et calcule dès le premier compte", () => {
    const data = buildEmptyData(
      { companyName: "Studio", baseCurrency: "MAD", vatRegistered: false, accounts: [{ name: "Banque", kind: "banque", currency: "MAD", balance: 12000 }, { name: "Compte EUR", kind: "banque", currency: "EUR", balance: 100 }], rates: { EUR: 10.8 } },
      T,
    );
    expect([data.invoices, data.payments, data.recurrences, data.budgets, data.settings.levies]).toEqual([[], [], [], [], []]);
    expect(data.demo).toBeUndefined();
    expect(cashPosition(data, T).total).toBe(13080);
    expect(forecast(data, { today: T, days: 30 }).end).toBe(13080);
    expect(profitability(data, month.from, month.to).resultLabel).toBe("Résultat estimé avant prélèvements");
  });
});

describe("Saisie le jour de la configuration", () => {
  it("une dépense payée le jour même est bien déduite du solde du matin", () => {
    let data = buildEmptyData({ companyName: "X", baseCurrency: "EUR", vatRegistered: false, accounts: [{ name: "B", kind: "banque", currency: "EUR", balance: 5000 }] }, T);
    data = { ...data, invoices: [inv({ id: "d", kind: "fournisseur", amountHT: 300, issueDate: T, dueDate: T })] };
    data = record(data, { id: "p", invoiceId: "d", accountId: "compte-1", date: T, amount: 300 }, T);
    expect(cashPosition(data, T).total).toBe(4700);
  });

  it("répare les données enregistrées avec l'ancien format", () => {
    const old = { ...base(), accounts: [{ ...base().accounts[0]!, openingDate: T }], payments: [{ id: "p", accountId: "a", date: T, amount: 300 }] };
    expect(cashPosition(old, T).total).toBe(5000);
    expect(cashPosition(migrateData(old), T).total).toBe(5300);
    expect(migrateData(migrateData(old)).accounts[0]!.openingDate).toBe(addDays(T, -1));
  });
});
