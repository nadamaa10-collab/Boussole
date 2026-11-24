import { addDays, addMonths, type ISODate } from "./dates";
import type { FinanceData, Recurrence } from "./types";

export interface Occurrence {
  recurrence: Recurrence;
  /** Date théorique de la série (clé de l'occurrence). */
  key: ISODate;
  /** Date réelle prévue (peut être modifiée ponctuellement). */
  date: ISODate;
  amount: number;
  confirmed: boolean;
}

function nthDate(r: Recurrence, n: number): ISODate {
  switch (r.frequency) {
    case "hebdomadaire":
      return addDays(r.startDate, 7 * n);
    case "mensuelle":
      return addMonths(r.startDate, n);
    case "trimestrielle":
      return addMonths(r.startDate, 3 * n);
    case "annuelle":
      return addMonths(r.startDate, 12 * n);
  }
}

/** Nombre d'occurrences par mois (pour ramener une série à un coût mensuel). */
export function perMonth(r: Recurrence): number {
  return { hebdomadaire: 52 / 12, mensuelle: 1, trimestrielle: 1 / 3, annuelle: 1 / 12 }[r.frequency];
}

/** Occurrences dont la date prévue tombe dans [from, to]. */
export function occurrences(data: Pick<FinanceData, "payments">, r: Recurrence, from: ISODate, to: ISODate): Occurrence[] {
  const out: Occurrence[] = [];
  for (let n = 0; n < 2000; n++) {
    const key = nthDate(r, n);
    if (r.endDate && key > r.endDate) break;
    const o = r.overrides?.[key];
    const date = o?.date ?? key;
    if (key > to && date > to) break;
    if (o?.skip || date < from || date > to) continue;
    const confirmed = data.payments.some((p) => p.recurrenceId === r.id && p.occurrenceDate === key);
    out.push({ recurrence: r, key, date, amount: o?.amount ?? r.amount, confirmed });
  }
  return out;
}

/** Modifie une seule occurrence, sans changer le reste de la série. */
export function overrideOccurrence(
  r: Recurrence,
  key: ISODate,
  change: { amount?: number; date?: ISODate; skip?: boolean },
): Recurrence {
  return { ...r, overrides: { ...r.overrides, [key]: { ...r.overrides?.[key], ...change } } };
}
