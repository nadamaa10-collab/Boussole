/** Dates au format ISO « AAAA-MM-JJ », manipulées en UTC pour éviter les décalages de fuseau. */
export type ISODate = string;

const DAY_MS = 86_400_000;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function toUTC(d: ISODate): number {
  const [y, m, dd] = d.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, dd);
}

function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isValidDate(d: unknown): d is ISODate {
  if (typeof d !== "string" || !ISO_RE.test(d)) return false;
  return fromUTC(toUTC(d)) === d;
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromUTC(toUTC(d) + n * DAY_MS);
}

/** Nombre de jours de `a` à `b` (positif si b est après a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
}

/** Ajoute n mois en restant sur le même jour (ou le dernier jour du mois s'il n'existe pas). */
export function addMonths(d: ISODate, n: number): ISODate {
  const [y, m, dd] = d.split("-").map(Number) as [number, number, number];
  const lastDay = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return fromUTC(Date.UTC(y, m - 1 + n, Math.min(dd, lastDay)));
}

export const monthKey = (d: ISODate) => d.slice(0, 7);
export const startOfMonth = (month: string): ISODate => `${month}-01`;
export function endOfMonth(month: string): ISODate {
  return addDays(addMonths(startOfMonth(month), 1), -1);
}

/** Liste des mois (AAAA-MM) entre deux dates incluses. */
export function monthsBetween(from: ISODate, to: ISODate): string[] {
  const out: string[] = [];
  let cur = startOfMonth(monthKey(from));
  while (cur <= to) {
    out.push(monthKey(cur));
    cur = addMonths(cur, 1);
  }
  return out;
}

/** Nombre de jours communs à [a1, a2] et [b1, b2] (bornes incluses). */
export function overlapDays(a1: ISODate, a2: ISODate, b1: ISODate, b2: ISODate): number {
  const start = a1 > b1 ? a1 : b1;
  const end = a2 < b2 ? a2 : b2;
  return end < start ? 0 : diffDays(start, end) + 1;
}

export const maxDate = (a: ISODate, b: ISODate) => (a > b ? a : b);
export const minDate = (a: ISODate, b: ISODate) => (a < b ? a : b);

export function formatDateFr(d: ISODate): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(toUTC(d)));
}
