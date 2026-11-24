import { addDays, addMonths, endOfMonth, monthKey, startOfMonth, type ISODate } from "./dates";
import { convert } from "./fx";
import { moneyEpsilon, roundMoney, sumMoney } from "./money";
import { profitability } from "./profitability";
import type { FinanceData, Levy } from "./types";

/**
 * Échéancier des impôts et cotisations configurés.
 * Le montant de chaque période est estimé à partir de ce qui est saisi (CA ou résultat de la période).
 * Il est payé le mois qui suit la fin de la période, au jour choisi par l'utilisateur.
 * Rien n'est inventé : sans prélèvement configuré, l'échéancier est vide.
 */

export interface LevyDue {
  levy: Levy;
  /** Clé de période : « 2026-11 », « 2026-T4 » ou « 2026 ». */
  period: string;
  periodLabel: string;
  periodStart: ISODate;
  periodEnd: ISODate;
  dueDate: ISODate;
  /** Montant estimé dû pour la période, en devise principale. */
  amount: number;
  paid: number;
  remaining: number;
  /** true tant que la période n'est pas terminée : le montant peut encore augmenter. */
  provisional: boolean;
}

const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function periodOf(levy: Levy, date: ISODate) {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const freq = levy.frequency ?? "trimestrielle";
  if (freq === "mensuelle") {
    return { key: monthKey(date), label: `${MONTHS_FR[m - 1]} ${y}`, start: startOfMonth(monthKey(date)), end: endOfMonth(monthKey(date)) };
  }
  if (freq === "annuelle") {
    return { key: String(y), label: `année ${y}`, start: `${y}-01-01`, end: `${y}-12-31` };
  }
  const q = Math.floor((m - 1) / 3) + 1;
  const start = `${y}-${String(3 * q - 2).padStart(2, "0")}-01`;
  return { key: `${y}-T${q}`, label: `${q}${q === 1 ? "er" : "e"} trimestre ${y}`, start, end: endOfMonth(monthKey(addMonths(start, 2))) };
}

function dueDateOf(levy: Levy, periodEnd: ISODate): ISODate {
  const next = addMonths(startOfMonth(monthKey(periodEnd)), 1);
  const last = endOfMonth(monthKey(next));
  const day = Math.min(levy.dueDay ?? 31, Number(last.slice(8, 10)));
  return `${next.slice(0, 8)}${String(day).padStart(2, "0")}`;
}

/** Échéances dont la date de paiement tombe dans [from, to]. */
export function levySchedule(data: FinanceData, from: ISODate, to: ISODate, today: ISODate): LevyDue[] {
  const base = data.settings.baseCurrency;
  const out: LevyDue[] = [];
  for (const levy of data.settings.levies) {
    // On parcourt les périodes dont l'échéance peut tomber dans la fenêtre.
    let cursor = periodOf(levy, addMonths(from, -13)).start;
    if (cursor < startOfMonth(monthKey(levy.validFrom))) cursor = periodOf(levy, levy.validFrom).start;
    for (let guard = 0; guard < 40; guard++) {
      const p = periodOf(levy, cursor);
      const dueDate = dueDateOf(levy, p.end);
      if (dueDate > to) break;
      cursor = addDays(p.end, 1);
      if (dueDate < from || p.start < periodOf(levy, levy.validFrom).start) continue;
      const line = profitability(data, p.start, p.end).levies?.find((l) => l.label === levy.label);
      const amount = line?.amount ?? 0;
      const paidParts: number[] = [];
      for (const m of data.movements) {
        if (m.type !== "prelevement" || m.levyLabel !== levy.label || m.period !== p.key) continue;
        const acc = data.accounts.find((a) => a.id === m.accountId);
        const conv = acc && convert(m.amount, acc.currency, base, data.rates, m.date);
        if (conv) paidParts.push(conv.value);
      }
      const paid = sumMoney(paidParts, base);
      const remaining = Math.max(0, roundMoney(amount - paid, base));
      if (amount <= moneyEpsilon(base) && paid <= 0) continue;
      out.push({ levy, period: p.key, periodLabel: p.label, periodStart: p.start, periodEnd: p.end, dueDate, amount, paid, remaining, provisional: p.end >= today });
    }
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
