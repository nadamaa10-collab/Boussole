import { addDays, endOfMonth, monthKey, monthsBetween, startOfMonth, type ISODate } from "./dates";
import { convert } from "./fx";
import { invoiceState } from "./invoices";
import { formatMoney, roundMoney, sumMoney } from "./money";
import { cashFlows, cashPosition } from "./cash";
import { forecast } from "./forecast";
import { profitability } from "./profitability";
import { perMonth } from "./recurrence";
import type { FinanceData } from "./types";

/* ------------------------------------------------------------------ */
/* Engagements : ce qu'on me doit / ce que je dois                     */
/* ------------------------------------------------------------------ */

export interface Commitment {
  invoiceId: string;
  party: string;
  description: string;
  remaining: number;
  currency: string;
  /** Contre-valeur estimée en devise principale (null si taux manquant). */
  baseValue: number | null;
  estimatedFx: boolean;
  dueDate: ISODate;
  label: string;
  late: boolean;
}

export function commitments(data: FinanceData, today: ISODate) {
  const base = data.settings.baseCurrency;
  const build = (kind: "client" | "fournisseur") => {
    const items: Commitment[] = [];
    for (const inv of data.invoices.filter((i) => i.kind === kind)) {
      const st = invoiceState(inv, data.payments, today, data.settings.locale);
      if (st.remaining <= 0) continue;
      const conv = convert(st.remaining, inv.currency, base, data.rates, today);
      items.push({
        invoiceId: inv.id,
        party: inv.party,
        description: inv.description,
        remaining: st.remaining,
        currency: inv.currency,
        baseValue: conv?.value ?? null,
        estimatedFx: inv.currency !== base,
        dueDate: inv.expectedPaymentDate ?? inv.dueDate,
        label: st.label,
        late: st.due === "en_retard",
      });
    }
    items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const complete = items.every((i) => i.baseValue !== null);
    return {
      items,
      total: complete ? sumMoney(items.map((i) => i.baseValue!), base) : null,
      lateTotal: complete ? sumMoney(items.filter((i) => i.late).map((i) => i.baseValue!), base) : null,
    };
  };
  return { receivables: build("client"), payables: build("fournisseur") };
}

/* ------------------------------------------------------------------ */
/* Chiffre d'affaires moyen : les mois sans données ne valent pas zéro  */
/* ------------------------------------------------------------------ */

export type MonthStatus = "complet" | "partiel" | "sans_activite" | "sans_donnees";

export function monthlyRevenueStats(data: FinanceData, from: ISODate, today: ISODate) {
  const current = monthKey(today);
  const months = monthsBetween(from, today).map((m) => {
    const p = profitability(data, startOfMonth(m), endOfMonth(m));
    const hasData = p.revenueLines.length > 0 || p.chargeLines.length > 0;
    let status: MonthStatus;
    if (m === current || data.settings.incompleteMonths.includes(m)) status = hasData ? "partiel" : "sans_donnees";
    else if (data.settings.inactiveMonths.includes(m)) status = "sans_activite";
    else status = hasData ? "complet" : "sans_donnees";
    return { month: m, revenue: p.revenue, charges: p.charges, status };
  });
  const used = months.filter((m) => m.status === "complet" || m.status === "sans_activite");
  const base = data.settings.baseCurrency;
  return {
    months,
    monthsUsed: used.length,
    averageRevenue: used.length ? roundMoney(sumMoney(used.map((m) => m.revenue), base) / used.length, base) : null,
    averageCharges: used.length ? roundMoney(sumMoney(used.map((m) => m.charges), base) / used.length, base) : null,
    /** En dessous de 3 mois, la moyenne n'est pas présentée comme représentative. */
    representative: used.length >= 3,
    basis: `Moyenne sur ${used.length} mois complets ou confirmés sans activité (mois en cours, incomplets et sans données exclus).`,
  };
}

/* ------------------------------------------------------------------ */
/* Autonomie de trésorerie                                              */
/* ------------------------------------------------------------------ */

export function runway(data: FinanceData, today: ISODate) {
  const base = data.settings.baseCurrency;
  const cash = cashPosition(data, today).total;
  const reasons: string[] = [];
  if (cash === null) reasons.push("Taux de change manquant pour consolider vos comptes.");

  const essentials = data.recurrences.filter((r) => r.kind === "depense" && r.essential && (!r.endDate || r.endDate >= today));
  const monthlyParts: number[] = [];
  for (const r of essentials) {
    const conv = convert(r.amount * perMonth(r), r.currency, base, data.rates, today);
    if (conv) monthlyParts.push(conv.value);
    else reasons.push(`Taux ${r.currency} manquant pour « ${r.label} ».`);
  }
  const essentialMonthly = essentials.length ? sumMoney(monthlyParts, base) : null;
  if (!essentials.length) reasons.push("Marquez vos charges incompressibles (loyer, assurance…) pour calculer l'autonomie minimale.");

  const stats = monthlyRevenueStats(data, addDays(today, -365), today);
  const habitual = stats.monthsUsed >= 3 ? stats.averageCharges : null;
  if (habitual === null) reasons.push("Il faut au moins 3 mois complets pour estimer vos dépenses habituelles.");

  const months = (charges: number | null) => (cash !== null && charges && charges > 0 ? Math.max(0, Math.floor((cash / charges) * 10) / 10) : null);
  return {
    cash,
    incompressible: { monthlyCharges: essentialMonthly, months: months(essentialMonthly), formula: "Argent disponible aujourd'hui ÷ charges incompressibles mensuelles" },
    habituelles: { monthlyCharges: habitual, months: months(habitual), formula: `Argent disponible aujourd'hui ÷ dépenses mensuelles moyennes (${stats.monthsUsed} mois)` },
    note: "Les factures non encaissées ne sont pas comptées : seul l'argent déjà disponible l'est.",
    reasons,
  };
}

/* ------------------------------------------------------------------ */
/* CA minimum nécessaire                                                */
/* ------------------------------------------------------------------ */

export function breakEven(data: FinanceData, today: ISODate, input: { fixedMonthly?: number; variableRate?: number; targetPay?: number } = {}) {
  const base = data.settings.baseCurrency;
  const fixed = input.fixedMonthly ?? runway(data, today).incompressible.monthlyCharges;
  const variableRate = input.variableRate ?? data.settings.variableCostRate ?? 0;
  const targetPay = input.targetPay ?? data.settings.targetMonthlyPay ?? 0;
  const caLevy = data.settings.levies.filter((l) => l.base === "chiffre_affaires" && l.validFrom <= today).reduce((s, l) => s + l.rate, 0);
  const resultLevy = data.settings.levies.filter((l) => l.base === "resultat" && l.validFrom <= today).reduce((s, l) => s + l.rate, 0);
  const hypotheses = [
    `Charges fixes mensuelles : ${fixed === null ? "non renseignées" : formatMoney(fixed, base)}`,
    `Charges variables : ${Math.round(variableRate * 100)} % du CA (hypothèse saisie)`,
    `Prélèvements sur le CA : ${Math.round(caLevy * 1000) / 10} %`,
    `Prélèvements sur le résultat : ${Math.round(resultLevy * 1000) / 10} %`,
    `Rémunération visée : ${formatMoney(targetPay, base)} par mois, après prélèvements`,
  ];
  if (!data.settings.levies.length) hypotheses.push("Aucun prélèvement configuré : le seuil réel sera plus élevé.");
  const margin = 1 - variableRate - caLevy;
  if (fixed === null || margin <= 0 || resultLevy >= 1) {
    return { value: null, hypotheses, method: "", reason: fixed === null ? "Renseignez vos charges fixes." : "Hypothèses incohérentes (marge ≤ 0)." };
  }
  // Le résultat avant prélèvements doit couvrir la rémunération visée majorée des prélèvements sur résultat.
  const grossPay = targetPay / (1 - resultLevy);
  return {
    value: roundMoney((fixed + grossPay) / margin, base),
    hypotheses,
    method: "CA minimum = (charges fixes + rémunération visée ÷ (1 − taux sur résultat)) ÷ (1 − taux de charges variables − taux sur CA)",
    reason: null,
  };
}

/* ------------------------------------------------------------------ */
/* Budgets : engagé ≠ payé                                              */
/* ------------------------------------------------------------------ */

export function budgetStatus(data: FinanceData, month: string) {
  const base = data.settings.baseCurrency;
  const { warning, over } = data.settings.budgetThresholds;
  const from = startOfMonth(month);
  const to = endOfMonth(month);
  const p = profitability(data, from, to);

  // Payé : sorties réelles du mois, rattachées à la catégorie de leur facture ou récurrence.
  const paidByCat: Record<string, number[]> = {};
  const accounts = new Map(data.accounts.map((a) => [a.id, a]));
  for (const pay of data.payments) {
    if (pay.date < from || pay.date > to) continue;
    const inv = pay.invoiceId ? data.invoices.find((i) => i.id === pay.invoiceId) : undefined;
    const rec = pay.recurrenceId ? data.recurrences.find((r) => r.id === pay.recurrenceId) : undefined;
    const cat = inv?.kind === "fournisseur" ? inv.category : rec?.kind === "depense" ? rec.category : null;
    const acc = accounts.get(pay.accountId);
    if (!cat || !acc) continue;
    const conv = convert(pay.amount, acc.currency, base, data.rates, pay.date);
    if (conv) (paidByCat[cat] ??= []).push(conv.value);
  }

  return data.budgets
    .filter((b) => b.monthly)
    .map((b) => {
      const engaged = p.chargesByCategory[b.category] ?? 0;
      const paid = sumMoney(paidByCat[b.category] ?? [], base);
      const ratio = engaged / b.monthly!;
      return {
        category: b.category,
        budget: b.monthly!,
        engaged,
        paid,
        remaining: roundMoney(b.monthly! - engaged, base),
        percent: Math.round(ratio * 100),
        level: ratio > over ? ("depasse" as const) : ratio >= warning ? ("alerte" as const) : ("normal" as const),
      };
    });
}

/* ------------------------------------------------------------------ */
/* Actions prioritaires                                                 */
/* ------------------------------------------------------------------ */

export interface PriorityAction {
  severity: 1 | 2 | 3; // 1 = urgent
  impact: number;
  title: string;
  detail: string;
  kind: "relance" | "echeance_client" | "fournisseur" | "risque_tresorerie" | "budget" | "depense_inhabituelle";
  targetId?: string;
}

export function priorityActions(data: FinanceData, today: ISODate, limit = 6): PriorityAction[] {
  const base = data.settings.baseCurrency;
  const fmt = (v: number) => formatMoney(v, base, data.settings.locale);
  const actions: PriorityAction[] = [];
  const { receivables, payables } = commitments(data, today);

  for (const c of receivables.items) {
    const impact = c.baseValue ?? 0;
    if (c.late) actions.push({ severity: 1, impact, kind: "relance", title: `Relancer ${c.party}`, detail: c.label, targetId: c.invoiceId });
    else if (c.dueDate <= addDays(today, 7)) actions.push({ severity: 3, impact, kind: "echeance_client", title: `${c.party} doit payer bientôt`, detail: c.label, targetId: c.invoiceId });
  }
  for (const c of payables.items) {
    if (c.dueDate <= addDays(today, 7)) {
      actions.push({ severity: c.late ? 1 : 2, impact: c.baseValue ?? 0, kind: "fournisseur", title: `Payer ${c.party}`, detail: c.label, targetId: c.invoiceId });
    }
  }

  const f = forecast(data, { today, days: 30 });
  if (f.firstNegative) {
    actions.push({ severity: 1, impact: -f.min!.balance, kind: "risque_tresorerie", title: "Risque de découvert dans les 30 jours", detail: f.alert ?? "" });
  }

  for (const b of budgetStatus(data, monthKey(today))) {
    if (b.level !== "normal") {
      actions.push({
        severity: b.level === "depasse" ? 2 : 3,
        impact: Math.max(0, -b.remaining),
        kind: "budget",
        title: `Budget « ${b.category} » ${b.level === "depasse" ? "dépassé" : b.percent >= 100 ? "atteint" : "presque atteint"}`,
        detail: `${b.percent} % consommé (${fmt(b.engaged)} sur ${fmt(b.budget)})`,
      });
    }
  }

  // Dépense inhabituelle : plus de 2× la moyenne de sa catégorie sur 3 dépenses précédentes minimum.
  const since = addDays(today, -30);
  for (const inv of data.invoices.filter((i) => i.kind === "fournisseur" && !i.cancelled && i.issueDate >= since && i.issueDate <= today)) {
    const previous = data.invoices.filter((o) => o.kind === "fournisseur" && !o.cancelled && o.category === inv.category && o.issueDate < inv.issueDate && o.currency === inv.currency);
    if (previous.length < 3) continue;
    const avg = previous.reduce((s, o) => s + o.amountHT, 0) / previous.length;
    if (inv.amountHT > 2 * avg) {
      actions.push({ severity: 3, impact: inv.amountHT - avg, kind: "depense_inhabituelle", title: `Dépense inhabituelle : ${inv.party}`, detail: `${Math.round(inv.amountHT / avg)}× la moyenne de « ${inv.category} »`, targetId: inv.id });
    }
  }

  return actions.sort((a, b) => a.severity - b.severity || b.impact - a.impact).slice(0, limit);
}

/** Dernière activité enregistrée, pour afficher la fraîcheur des données. */
export function lastActivity(data: FinanceData): ISODate | null {
  return cashFlows(data).map((f) => f.date).sort().at(-1) ?? null;
}
