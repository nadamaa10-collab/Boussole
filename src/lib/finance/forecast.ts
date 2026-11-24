import { addDays, maxDate, type ISODate } from "./dates";
import { convert } from "./fx";
import { invoiceState } from "./invoices";
import { formatMoney, roundMoney, sumMoney } from "./money";
import { occurrences } from "./recurrence";
import { cashPosition } from "./cash";
import { levySchedule } from "./levies";
import type { Confidence, FinanceData } from "./types";
import { formatDateFr } from "./dates";

export interface ForecastEvent {
  date: ISODate;
  label: string;
  /** Signé, en devise principale (valeur estimée si devise étrangère). */
  amount: number;
  original: { amount: number; currency: string };
  direction: "encaissement" | "decaissement";
  /** prevu = à la date renseignée ; en_retard = date dépassée, reportée à aujourd'hui ; simulation = scénario. */
  status: "prevu" | "en_retard" | "simulation";
  confidence: Confidence;
  estimatedFx: boolean;
  /** Décalé par le scénario prudent. */
  shifted: boolean;
  sourceId: string;
}

export interface SimulationEvent {
  date: ISODate;
  label: string;
  /** Signé, en devise principale. */
  amount: number;
}

export interface ForecastOptions {
  today: ISODate;
  days: number;
  scenario?: "standard" | "prudent";
  /** Report appliqué aux encaissements incertains ou en retard dans le scénario prudent. */
  prudentDelayDays?: number;
  /** Taux de simulation par devise (1 unité = x devise principale). */
  fxOverrides?: Record<string, number>;
  /** Retard simulé sur une facture client. */
  delays?: Record<string, number>;
  /** Dépense exceptionnelle, nouveau contrat, etc. */
  simulations?: SimulationEvent[];
  /** Baisse/hausse simulée, ex. { recettes: -0.2 } = encaissements prévus −20 %. */
  variation?: { recettes?: number; depenses?: number };
}

export interface ForecastPoint {
  date: ISODate;
  balance: number;
  events: ForecastEvent[];
}

export interface Forecast {
  available: boolean;
  reason?: string;
  start: number;
  points: ForecastPoint[];
  events: ForecastEvent[];
  /** Mouvements impossibles à convertir faute de taux (signalés, jamais ignorés en silence). */
  unconverted: { label: string; amount: number; currency: string }[];
  min: { date: ISODate; balance: number } | null;
  firstNegative: { date: ISODate; balance: number } | null;
  end: number;
  totals: { inflows: number; outflows: number };
  alert: string | null;
}

/** Échéancier des encaissements et décaissements futurs, en devise principale. */
export function forecastEvents(data: FinanceData, opts: ForecastOptions) {
  const { today, days, scenario = "standard", prudentDelayDays = 30, fxOverrides = {}, delays = {}, variation = {} } = opts;
  const base = data.settings.baseCurrency;
  const horizon = addDays(today, days);
  const events: ForecastEvent[] = [];
  const unconverted: Forecast["unconverted"] = [];

  const push = (e: Omit<ForecastEvent, "amount" | "estimatedFx"> & { rateDate: ISODate }) => {
    if (e.date > horizon) return;
    const conv = convert(e.original.amount, e.original.currency, base, data.rates, e.rateDate, fxOverrides[e.original.currency]);
    if (!conv) {
      unconverted.push({ label: e.label, amount: e.original.amount, currency: e.original.currency });
      return;
    }
    const factor = 1 + ((e.direction === "encaissement" ? variation.recettes : variation.depenses) ?? 0);
    const value = roundMoney(conv.value * factor, base);
    const { rateDate: _r, ...rest } = e;
    events.push({ ...rest, amount: e.direction === "encaissement" ? value : -value, estimatedFx: e.original.currency !== base });
  };

  for (const inv of data.invoices) {
    const st = invoiceState(inv, data.payments, today);
    if (st.remaining <= 0) continue;
    const isClient = inv.kind === "client";
    let date = inv.expectedPaymentDate ?? inv.dueDate;
    if (isClient && delays[inv.id]) date = addDays(date, delays[inv.id]!);
    const late = date < today;
    date = maxDate(date, today);
    const confidence = inv.confidence ?? (isClient ? "probable" : "confirme");
    let shifted = false;
    if (scenario === "prudent" && isClient && (confidence === "incertain" || late)) {
      date = addDays(date, prudentDelayDays);
      shifted = true;
    }
    push({
      date,
      rateDate: today,
      label: `${inv.party} — ${inv.description}`,
      original: { amount: st.remaining, currency: inv.currency },
      direction: isClient ? "encaissement" : "decaissement",
      status: late ? "en_retard" : "prevu",
      confidence,
      shifted,
      sourceId: inv.id,
    });
  }

  for (const r of data.recurrences) {
    // Occurrences non confirmées des 90 derniers jours : dues, reportées à aujourd'hui.
    for (const o of occurrences(data, r, addDays(today, -90), horizon)) {
      if (o.confirmed) continue;
      const late = o.date < today;
      push({
        date: maxDate(o.date, today),
        rateDate: today,
        label: r.label,
        original: { amount: o.amount, currency: r.currency },
        direction: r.kind === "recette" ? "encaissement" : "decaissement",
        status: late ? "en_retard" : "prevu",
        confidence: r.kind === "recette" ? "probable" : "confirme",
        shifted: false,
        sourceId: `${r.id}@${o.key}`,
      });
    }
  }

  // Impôts et cotisations configurés : échéances non payées (les retards sont dus aujourd'hui).
  for (const d of levySchedule(data, addDays(today, -120), horizon, today)) {
    if (d.remaining <= 0) continue;
    push({
      date: maxDate(d.dueDate, today),
      rateDate: today,
      label: `${d.levy.label} — ${d.periodLabel}${d.provisional ? " (estimation en cours)" : ""}`,
      original: { amount: d.remaining, currency: base },
      direction: "decaissement",
      status: d.dueDate < today ? "en_retard" : "prevu",
      confidence: "confirme",
      shifted: false,
      sourceId: `levy:${d.levy.label}@${d.period}`,
    });
  }

  for (const [i, s] of (opts.simulations ?? []).entries()) {
    if (s.date < today || s.date > horizon) continue;
    events.push({
      date: s.date,
      label: s.label,
      amount: roundMoney(s.amount, base),
      original: { amount: Math.abs(s.amount), currency: base },
      direction: s.amount >= 0 ? "encaissement" : "decaissement",
      status: "simulation",
      confidence: "incertain",
      estimatedFx: false,
      shifted: false,
      sourceId: `simulation-${i}`,
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.amount - b.amount);
  return { events: events.filter((e) => e.date <= horizon), unconverted };
}

/**
 * Trésorerie chronologique :
 * solde(J) = solde actuel + encaissements prévus cumulés jusqu'à J − décaissements prévus cumulés jusqu'à J.
 * Le solde actuel inclut déjà les mouvements réalisés : ils ne sont jamais recomptés.
 */
export function forecast(data: FinanceData, opts: ForecastOptions): Forecast {
  const base = data.settings.baseCurrency;
  const pos = cashPosition(data, opts.today);
  const empty: Forecast = {
    available: false,
    start: 0,
    points: [],
    events: [],
    unconverted: [],
    min: null,
    firstNegative: null,
    end: 0,
    totals: { inflows: 0, outflows: 0 },
    alert: null,
  };
  if (pos.total === null) return { ...empty, reason: `Taux de change manquant : ${pos.missingRates.join(", ")}.` };
  if (data.accounts.length === 0) return { ...empty, reason: "Ajoutez un compte et son solde pour calculer une prévision." };

  const { events, unconverted } = forecastEvents(data, opts);
  const points: ForecastPoint[] = [];
  let balance = pos.total;
  // Le point le plus bas part du solde réel de ce matin : il ne peut pas dépasser l'argent disponible.
  let min: Forecast["min"] = { date: opts.today, balance: pos.total };
  let firstNegative: Forecast["firstNegative"] = null;
  for (let d = 0; d <= opts.days; d++) {
    const date = addDays(opts.today, d);
    const dayEvents = events.filter((e) => e.date === date);
    balance = sumMoney([balance, ...dayEvents.map((e) => e.amount)], base);
    points.push({ date, balance, events: dayEvents });
    if (!min || balance < min.balance) min = { date, balance };
    if (!firstNegative && balance < 0) firstNegative = { date, balance };
  }

  let alert: string | null = null;
  if (min && min.balance < 0) {
    const next = events.find((e) => e.date > min!.date && e.amount > 0);
    alert =
      `Attention : votre solde pourrait atteindre ${formatMoney(min.balance, base, data.settings.locale)} le ${formatDateFr(min.date)}` +
      (next ? `, avant l'encaissement prévu de ${next.label.split(" — ")[0]} (${formatDateFr(next.date)}).` : ".");
  }

  return {
    available: true,
    start: pos.total,
    points,
    events,
    unconverted,
    min,
    firstNegative,
    end: balance,
    totals: {
      inflows: sumMoney(events.filter((e) => e.amount > 0).map((e) => e.amount), base),
      outflows: -sumMoney(events.filter((e) => e.amount < 0).map((e) => e.amount), base),
    },
    alert,
  };
}

/** Les seules dates où le solde change, pour un tableau lisible. */
export function forecastSteps(f: Forecast) {
  return f.points.filter((p, i) => i === 0 || p.events.length > 0);
}
