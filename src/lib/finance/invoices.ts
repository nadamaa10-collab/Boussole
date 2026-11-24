import { diffDays, formatDateFr, isValidDate, type ISODate } from "./dates";
import { findRate, type RateQuote } from "./fx";
import { formatMoney, moneyEpsilon, roundMoney, sumMoney } from "./money";
import type { FinanceData, Invoice, Payment } from "./types";

export type SettlementStatus = "non_payee" | "partielle" | "payee" | "annulee";
export type DueStatus = "a_venir" | "aujourdhui" | "en_retard";

export interface InvoiceState {
  total: number;
  paid: number;
  remaining: number;
  /** Trop-perçu éventuel (à rembourser ou à imputer). */
  overpaid: number;
  settlement: SettlementStatus;
  /** null quand la facture est soldée ou annulée. */
  due: DueStatus | null;
  /** Jours avant l'échéance (négatif = jours de retard). */
  daysToDue: number;
  lastPaymentDate?: ISODate;
  payments: Payment[];
  label: string;
}

export function invoiceTotal(inv: Invoice): number {
  return roundMoney(inv.amountHT + inv.vatAmount, inv.currency);
}

/** Montant soldé par un paiement, dans la devise de la facture. */
export function settledOf(p: Payment): number {
  return p.settledAmount ?? p.amount;
}

/** Seuls les paiements datés au plus tard aujourd'hui sont des mouvements réels. */
export function paymentsOf(data: Pick<FinanceData, "payments">, invoiceId: string, today: ISODate): Payment[] {
  return data.payments
    .filter((p) => p.invoiceId === invoiceId && p.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function invoiceState(inv: Invoice, payments: Payment[], today: ISODate, locale = "fr-FR"): InvoiceState {
  const total = invoiceTotal(inv);
  const own = payments.filter((p) => p.invoiceId === inv.id && p.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const paid = sumMoney(own.map(settledOf), inv.currency);
  const eps = moneyEpsilon(inv.currency);
  const remaining = inv.cancelled ? 0 : Math.max(0, roundMoney(total - paid, inv.currency));
  const overpaid = Math.max(0, roundMoney(paid - total, inv.currency));
  const daysToDue = diffDays(today, inv.dueDate);
  const lastPaymentDate = own.at(-1)?.date;
  const fmt = (v: number) => formatMoney(v, inv.currency, locale);

  let settlement: SettlementStatus;
  if (inv.cancelled) settlement = "annulee";
  else if (paid <= eps) settlement = "non_payee";
  else if (remaining <= eps) settlement = "payee";
  else settlement = "partielle";

  let due: DueStatus | null = null;
  if (settlement === "non_payee" || settlement === "partielle") {
    due = daysToDue < 0 ? "en_retard" : daysToDue === 0 ? "aujourdhui" : "a_venir";
  }

  const echeance =
    due === "en_retard"
      ? `en retard de ${-daysToDue} jour${-daysToDue > 1 ? "s" : ""}`
      : due === "aujourdhui"
        ? "échéance aujourd'hui"
        : `échéance dans ${daysToDue} jour${daysToDue > 1 ? "s" : ""}`;

  let label: string;
  switch (settlement) {
    case "annulee":
      label = "Annulée";
      break;
    case "payee":
      label = `Payée — le ${formatDateFr(lastPaymentDate!)}`;
      break;
    case "partielle":
      label = due === "en_retard" ? `Paiement partiel en retard — ${fmt(remaining)} restants` : `Paiement partiel — ${fmt(remaining)} restants, ${echeance}`;
      break;
    default:
      label = due === "en_retard" ? `Impayée — ${echeance}` : `${inv.kind === "client" ? "Facture envoyée" : "À payer"} — ${echeance}`;
  }

  return { total, paid, remaining, overpaid, settlement, due, daysToDue, lastPaymentDate, payments: own, label };
}

/**
 * Taux « économique » : celui de la date de facture, figé pour la rentabilité.
 * Retourne null si aucun taux n'est connu (le montant est alors signalé, jamais inventé).
 */
export function economicQuote(data: FinanceData, inv: Invoice): RateQuote | null {
  const base = data.settings.baseCurrency;
  if (inv.currency === base) return { rate: 1, date: inv.issueDate, source: "Même devise", demo: false, estimated: false };
  if (inv.economicRate && inv.economicRate.base === base) {
    return { rate: inv.economicRate.rate, date: inv.economicRate.date, source: inv.economicRate.source, demo: false, estimated: false };
  }
  return findRate(data.rates, inv.currency, base, inv.issueDate);
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export function validateInvoice(data: FinanceData, inv: Invoice): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!inv.party.trim()) errors.push(inv.kind === "client" ? "Indiquez le client." : "Indiquez le fournisseur.");
  if (!Number.isFinite(inv.amountHT) || inv.amountHT <= 0) errors.push("Le montant doit être supérieur à zéro.");
  if (!Number.isFinite(inv.vatAmount) || inv.vatAmount < 0) errors.push("La TVA ne peut pas être négative.");
  if (!isValidDate(inv.issueDate) || !isValidDate(inv.dueDate)) errors.push("Dates invalides.");
  else if (inv.dueDate < inv.issueDate) errors.push("L'échéance ne peut pas précéder la date de facture.");
  if (inv.expectedPaymentDate && !isValidDate(inv.expectedPaymentDate)) errors.push("Date de paiement estimée invalide.");
  if (inv.servicePeriod && inv.servicePeriod.end < inv.servicePeriod.start) errors.push("La période de prestation est inversée.");
  if (inv.nature === "immobilisation" && !inv.usefulLifeMonths) warnings.push("Sans durée d'amortissement, l'achat sera compté en charge en une seule fois.");
  if (inv.currency !== data.settings.baseCurrency && !economicQuote(data, inv)) {
    errors.push(`Indiquez le taux ${inv.currency} → ${data.settings.baseCurrency} à la date de la facture.`);
  }
  const dup = data.invoices.find(
    (o) =>
      o.id !== inv.id &&
      !o.cancelled &&
      o.kind === inv.kind &&
      ((inv.reference && o.reference === inv.reference && o.party === inv.party) ||
        (o.party === inv.party && o.issueDate === inv.issueDate && o.amountHT === inv.amountHT && o.currency === inv.currency)),
  );
  if (dup) warnings.push(`Doublon possible avec « ${dup.description} » (${dup.issueDate}).`);
  return { errors, warnings };
}

export function validatePayment(
  data: FinanceData,
  p: Payment,
  today: ISODate,
  opts: { allowOverpayment?: boolean } = {},
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const account = data.accounts.find((a) => a.id === p.accountId);
  if (!account) errors.push("Compte inconnu.");
  if (!Number.isFinite(p.amount) || p.amount === 0) errors.push("Le montant doit être différent de zéro.");
  if (!isValidDate(p.date)) errors.push("Date invalide.");
  else if (p.date > today) errors.push("Un paiement effectué ne peut pas être daté dans le futur : renseignez plutôt la date prévue sur la facture.");
  if (account && isValidDate(p.date) && p.date <= account.openingDate) {
    warnings.push("Ce paiement est antérieur au solde de départ du compte : il est déjà inclus dans ce solde et ne le modifiera pas.");
  }

  if (p.invoiceId) {
    const inv = data.invoices.find((i) => i.id === p.invoiceId);
    if (!inv) errors.push("Facture introuvable.");
    else {
      if (inv.cancelled) errors.push("Cette facture est annulée.");
      if (account && account.currency !== inv.currency && p.settledAmount === undefined) {
        errors.push(`Indiquez le montant soldé en ${inv.currency} (le compte est en ${account.currency}).`);
      }
      const state = invoiceState(inv, data.payments.filter((x) => x.id !== p.id), today);
      const settled = settledOf(p);
      if (settled > state.remaining + moneyEpsilon(inv.currency) && !opts.allowOverpayment) {
        errors.push(
          `Le paiement (${formatMoney(settled, inv.currency)}) dépasse le reste dû (${formatMoney(state.remaining, inv.currency)}). Confirmez s'il s'agit d'un trop-perçu.`,
        );
      }
      if (settled < 0 && -settled > state.paid + moneyEpsilon(inv.currency)) errors.push("Le remboursement dépasse ce qui a été payé.");
      const dup = data.payments.find((x) => x.id !== p.id && x.invoiceId === p.invoiceId && x.date === p.date && x.amount === p.amount);
      if (dup) warnings.push("Un paiement identique existe déjà pour cette facture à cette date.");
    }
  }
  return { errors, warnings };
}

/** Enregistre un paiement après validation. Les données ne sont jamais modifiées en place. */
export function recordPayment(
  data: FinanceData,
  p: Payment,
  today: ISODate,
  opts: { allowOverpayment?: boolean } = {},
): FinanceData {
  const { errors } = validatePayment(data, p, today, opts);
  if (errors.length) throw new Error(errors.join(" "));
  return { ...data, payments: [...data.payments.filter((x) => x.id !== p.id), p] };
}
