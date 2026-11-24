import type { ISODate } from "./dates";
import { findRate, type RateQuote } from "./fx";
import { economicQuote } from "./invoices";
import type { CurrencyCode } from "./money";
import { roundMoney } from "./money";
import type { FinanceData } from "./types";

export interface BaseChangePreview {
  from: CurrencyCode;
  to: CurrencyCode;
  referenceDate: ISODate;
  /** Factures dont la valeur économique sera recalculée (montants d'origine inchangés). */
  invoices: { id: string; description: string; currency: CurrencyCode; issueDate: ISODate; quote: RateQuote | null; usesReferenceRate: boolean }[];
  /** Taux de la date de référence, pour budgets et objectifs (exprimés dans la devise principale). */
  referenceQuote: RateQuote | null;
  missingRates: string[];
  canApply: boolean;
  consequences: string[];
}

/**
 * Aperçu d'un changement de devise principale. Rien n'est modifié.
 * Le taux économique de chaque facture est recalculé avec le taux historique à sa date
 * (ou, si l'utilisateur l'accepte, avec le taux de la date de référence, signalé comme tel).
 */
export function previewBaseCurrencyChange(
  data: FinanceData,
  to: CurrencyCode,
  referenceDate: ISODate,
  opts: { allowReferenceRate?: boolean } = {},
): BaseChangePreview {
  const from = data.settings.baseCurrency;
  const missing = new Set<string>();
  const invoices = data.invoices.map((inv) => {
    let quote = findRate(data.rates, inv.currency, to, inv.issueDate);
    let usesReferenceRate = false;
    if (!quote && opts.allowReferenceRate) {
      quote = findRate(data.rates, inv.currency, to, referenceDate);
      usesReferenceRate = !!quote;
    }
    if (!quote) missing.add(`${inv.currency} → ${to} au ${inv.issueDate}`);
    return { id: inv.id, description: inv.description, currency: inv.currency, issueDate: inv.issueDate, quote, usesReferenceRate };
  });
  const referenceQuote = findRate(data.rates, from, to, referenceDate);
  if (!referenceQuote) missing.add(`${from} → ${to} au ${referenceDate}`);
  return {
    from,
    to,
    referenceDate,
    invoices,
    referenceQuote,
    missingRates: [...missing],
    canApply: missing.size === 0,
    consequences: [
      "Les montants facturés et payés restent identiques, dans leur devise d'origine.",
      `Les indicateurs consolidés seront affichés en ${to}.`,
      "La valeur économique de chaque facture est recalculée au taux de sa date ; l'ancien taux est conservé dans l'historique.",
      `Les budgets et objectifs sont convertis au taux du ${referenceDate}.`,
    ],
  };
}

/** Applique le changement après confirmation explicite de l'utilisateur. */
export function applyBaseCurrencyChange(data: FinanceData, preview: BaseChangePreview, confirmed: boolean): FinanceData {
  if (!confirmed) throw new Error("Le changement de devise principale doit être confirmé.");
  if (!preview.canApply) throw new Error(`Taux manquants : ${preview.missingRates.join(", ")}.`);
  const to = preview.to;
  const invoices = data.invoices.map((inv) => {
    const p = preview.invoices.find((x) => x.id === inv.id)!;
    const previous = economicQuote(data, inv);
    const history = [...(inv.economicRateHistory ?? [])];
    if (previous && inv.currency !== data.settings.baseCurrency) {
      history.push({ rate: previous.rate, date: previous.date, source: previous.source, base: data.settings.baseCurrency });
    }
    const economicRate =
      inv.currency === to
        ? undefined
        : { rate: p.quote!.rate, date: p.quote!.date, source: p.usesReferenceRate ? `${p.quote!.source} (taux de référence)` : p.quote!.source, base: to };
    return { ...inv, economicRate, economicRateHistory: history };
  });
  const rate = preview.referenceQuote!.rate;
  const conv = (v: number | undefined) => (v === undefined ? undefined : roundMoney(v * rate, to));
  return {
    ...data,
    invoices,
    budgets: data.budgets.map((b) => ({ ...b, monthly: conv(b.monthly), annual: conv(b.annual) })),
    settings: {
      ...data.settings,
      baseCurrency: to,
      targetMonthlyPay: conv(data.settings.targetMonthlyPay),
      cashReserveTarget: conv(data.settings.cashReserveTarget),
      monthlyRevenueTarget: conv(data.settings.monthlyRevenueTarget),
      baseCurrencyHistory: [
        ...(data.settings.baseCurrencyHistory ?? []),
        { from: data.settings.baseCurrency, to, date: preview.referenceDate, referenceDate: preview.referenceDate },
      ],
    },
  };
}
