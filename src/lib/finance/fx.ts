import type { ISODate } from "./dates";
import type { CurrencyCode } from "./money";
import { roundMoney } from "./money";
import type { FxRate } from "./types";

export interface RateQuote {
  rate: number;
  /** Date du taux réellement utilisé */
  date: ISODate;
  source: string;
  demo: boolean;
  /** true si le taux n'est pas celui du jour demandé (valeur indicative). */
  estimated: boolean;
}

/**
 * Cherche le taux connu le plus récent à `date` (direct ou inverse).
 * Retourne null s'il n'en existe aucun : l'application n'invente jamais de taux.
 */
export function findRate(rates: FxRate[], from: CurrencyCode, to: CurrencyCode, date: ISODate): RateQuote | null {
  if (from === to) return { rate: 1, date, source: "Même devise", demo: false, estimated: false };
  let best: RateQuote | null = null;
  for (const r of rates) {
    if (r.date > date || r.rate <= 0) continue;
    let rate: number | null = null;
    if (r.from === from && r.to === to) rate = r.rate;
    else if (r.from === to && r.to === from) rate = 1 / r.rate;
    if (rate === null) continue;
    if (!best || r.date > best.date) {
      best = { rate, date: r.date, source: r.source, demo: !!r.demo, estimated: r.date !== date };
    }
  }
  return best;
}

export interface Converted {
  value: number;
  quote: RateQuote;
}

/** Convertit avec un taux connu ou un taux de simulation explicite (`override`). */
export function convert(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: FxRate[],
  date: ISODate,
  override?: number,
): Converted | null {
  if (from !== to && override !== undefined && override > 0) {
    return {
      value: roundMoney(amount * override, to),
      quote: { rate: override, date, source: "Taux de simulation saisi", demo: false, estimated: true },
    };
  }
  const quote = findRate(rates, from, to, date);
  if (!quote) return null;
  return { value: roundMoney(amount * quote.rate, to), quote };
}
