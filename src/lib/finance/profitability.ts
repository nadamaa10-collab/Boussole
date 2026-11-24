import { addMonths, diffDays, monthKey, monthsBetween, overlapDays, type ISODate } from "./dates";
import { convert } from "./fx";
import { economicQuote, settledOf } from "./invoices";
import { roundMoney, sumMoney } from "./money";
import { occurrences } from "./recurrence";
import type { FinanceData, Invoice } from "./types";

export interface ProfitLine {
  label: string;
  category: string;
  amount: number;
  sourceId: string;
}

export interface Profitability {
  from: ISODate;
  to: ISODate;
  /** Revenus HT rattachés à la période (indépendamment de l'encaissement). */
  revenue: number;
  revenueLines: ProfitLine[];
  /** Charges d'exploitation rattachées à la période (y compris amortissements). */
  charges: number;
  chargeLines: ProfitLine[];
  chargesByCategory: Record<string, number>;
  /** « Ce que mon activité gagne » — résultat d'exploitation estimé. */
  operatingResult: number;
  /** Écarts de change réalisés (gains +, pertes −), séparés du chiffre d'affaires. */
  fxResult: number;
  interest: number;
  resultBeforeLevies: number;
  levies: { label: string; amount: number; rate: number; base: string; source: string }[] | null;
  resultAfterLevies: number | null;
  /** Libellé exact du dernier résultat affiché. */
  resultLabel: string;
  missing: string[];
}

/** Part d'une facture rattachée à la période : prorata des jours de prestation, sinon date de facture. */
function share(inv: Invoice, from: ISODate, to: ISODate): number {
  if (inv.servicePeriod) {
    const total = diffDays(inv.servicePeriod.start, inv.servicePeriod.end) + 1;
    return overlapDays(inv.servicePeriod.start, inv.servicePeriod.end, from, to) / total;
  }
  return inv.issueDate >= from && inv.issueDate <= to ? 1 : 0;
}

/** Part d'amortissement linéaire mensuel tombant dans la période. */
function depreciationShare(inv: Invoice, from: ISODate, to: ISODate): number {
  const months = inv.usefulLifeMonths!;
  const first = `${monthKey(inv.issueDate)}-01`;
  const last = addMonths(first, months - 1);
  const inPeriod = monthsBetween(from, to).filter((m) => `${m}-01` >= first && `${m}-01` <= last);
  return inPeriod.length / months;
}

export function profitability(data: FinanceData, from: ISODate, to: ISODate): Profitability {
  const base = data.settings.baseCurrency;
  const missing = new Set<string>();
  const revenueLines: ProfitLine[] = [];
  const chargeLines: ProfitLine[] = [];
  const fx: number[] = [];
  const interest: number[] = [];

  for (const inv of data.invoices) {
    if (inv.cancelled) continue;
    const quote = economicQuote(data, inv);
    if (!quote) {
      missing.add(`Taux ${inv.currency} → ${base} manquant pour « ${inv.description} » : montant exclu.`);
      continue;
    }
    // Sans TVA récupérable, la TVA payée est un coût.
    const costBase = data.settings.vatRegistered ? inv.amountHT : inv.amountHT + inv.vatAmount;
    if (inv.kind === "client") {
      const s = share(inv, from, to);
      if (s > 0) revenueLines.push({ label: `${inv.party} — ${inv.description}`, category: inv.category, amount: roundMoney(inv.amountHT * quote.rate * s, base), sourceId: inv.id });
    } else if (inv.nature === "immobilisation" && inv.usefulLifeMonths) {
      const s = depreciationShare(inv, from, to);
      if (s > 0) chargeLines.push({ label: `Amortissement — ${inv.description}`, category: "Amortissements", amount: roundMoney(costBase * quote.rate * s, base), sourceId: inv.id });
    } else {
      const s = share(inv, from, to);
      if (s > 0) chargeLines.push({ label: `${inv.party} — ${inv.description}`, category: inv.category, amount: roundMoney(costBase * quote.rate * s, base), sourceId: inv.id });
    }

    // Écart de change réalisé : valeur reçue/payée réelle vs valeur au taux de facturation.
    if (inv.currency !== base) {
      for (const p of data.payments.filter((x) => x.invoiceId === inv.id && x.date >= from && x.date <= to)) {
        const acc = data.accounts.find((a) => a.id === p.accountId);
        if (!acc) continue;
        const real = convert(p.amount, acc.currency, base, data.rates, p.date);
        if (!real) {
          missing.add(`Taux ${acc.currency} → ${base} manquant au ${p.date}.`);
          continue;
        }
        const expected = roundMoney(settledOf(p) * quote.rate, base);
        fx.push(inv.kind === "client" ? real.value - expected : expected - real.value);
      }
    }
  }

  for (const r of data.recurrences) {
    if (r.nature !== "exploitation") continue;
    for (const o of occurrences(data, r, from, to)) {
      const conv = convert(o.amount, r.currency, base, data.rates, o.date);
      if (!conv) {
        missing.add(`Taux ${r.currency} → ${base} manquant pour « ${r.label} ».`);
        continue;
      }
      const line = { label: r.label, category: r.category, amount: conv.value, sourceId: `${r.id}@${o.key}` };
      (r.kind === "recette" ? revenueLines : chargeLines).push(line);
    }
  }

  const fees = (accountId: string, amount: number, date: ISODate, label: string, id: string) => {
    const acc = data.accounts.find((a) => a.id === accountId);
    const conv = acc && convert(amount, acc.currency, base, data.rates, date);
    if (conv) chargeLines.push({ label, category: "Frais bancaires", amount: conv.value, sourceId: id });
    else missing.add(`Frais bancaires non convertis au ${date}.`);
  };
  for (const p of data.payments) if (p.fees && p.date >= from && p.date <= to) fees(p.accountId, p.fees, p.date, "Frais sur paiement", p.id);
  for (const m of data.movements) {
    if (m.date < from || m.date > to) continue;
    if (m.type === "frais_bancaires") fees(m.accountId, m.amount, m.date, m.description ?? "Frais bancaires", m.id);
    if (m.type === "remboursement_emprunt" && m.interestPart) {
      const acc = data.accounts.find((a) => a.id === m.accountId);
      const conv = acc && convert(m.interestPart, acc.currency, base, data.rates, m.date);
      if (conv) interest.push(conv.value);
    }
    // Apports, retraits, déblocages d'emprunt, capital remboursé et transferts : hors résultat.
  }

  const revenue = sumMoney(revenueLines.map((l) => l.amount), base);
  const charges = sumMoney(chargeLines.map((l) => l.amount), base);
  const chargesByCategory: Record<string, number> = {};
  for (const l of chargeLines) chargesByCategory[l.category] = roundMoney((chargesByCategory[l.category] ?? 0) + l.amount, base);
  const operatingResult = roundMoney(revenue - charges, base);
  const fxResult = sumMoney(fx, base);
  const interestTotal = sumMoney(interest, base);
  const resultBeforeLevies = roundMoney(operatingResult + fxResult - interestTotal, base);

  const activeLevies = data.settings.levies.filter((l) => l.validFrom <= to);
  let levies: Profitability["levies"] = null;
  let resultAfterLevies: number | null = null;
  if (activeLevies.length) {
    levies = activeLevies.map((l) => ({
      label: l.label,
      rate: l.rate,
      base: l.base,
      source: l.source,
      amount: roundMoney(l.rate * (l.base === "chiffre_affaires" ? revenue : Math.max(0, resultBeforeLevies)), base),
    }));
    resultAfterLevies = roundMoney(resultBeforeLevies - sumMoney(levies.map((l) => l.amount), base), base);
  } else {
    missing.add("Aucun prélèvement fiscal ou social configuré : le résultat est affiché avant prélèvements.");
  }

  return {
    from,
    to,
    revenue,
    revenueLines,
    charges,
    chargeLines,
    chargesByCategory,
    operatingResult,
    fxResult,
    interest: interestTotal,
    resultBeforeLevies,
    levies,
    resultAfterLevies,
    resultLabel: levies ? "Résultat estimé après prélèvements" : "Résultat estimé avant prélèvements",
    missing: [...missing],
  };
}
