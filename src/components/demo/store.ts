import { useCallback, useMemo, useState } from "react";
import {
  applyBaseCurrencyChange,
  buildDemoData,
  formatMoney,
  previewBaseCurrencyChange,
  recordPayment,
  validateInvoice,
  type FinanceData,
  type Invoice,
  type Movement,
  type Payment,
  type Recurrence,
} from "@/lib/finance";

export const TODAY = new Date().toISOString().slice(0, 10);

let seq = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export interface Toast {
  id: number;
  text: string;
  tone: "ok" | "error";
}

/** État de la démo : tout reste en mémoire, rien n'est enregistré. */
export function useDemo() {
  const [data, setData] = useState<FinanceData>(() => buildDemoData(TODAY));
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const base = data.settings.baseCurrency;
  const fmt = useCallback((v: number, currency = base) => formatMoney(v, currency, data.settings.locale), [base, data.settings.locale]);

  const actions = useMemo(
    () => ({
      reset() {
        setData(buildDemoData(TODAY));
        notify("Démo réinitialisée.");
      },
      /** Ajoute une facture ; renvoie les erreurs éventuelles (rien n'est ajouté dans ce cas). */
      addInvoice(inv: Invoice, paidNow?: { accountId: string; amount: number; settledAmount?: number }): string[] {
        const { errors } = validateInvoice(data, inv);
        if (errors.length) return errors;
        let next: FinanceData = { ...data, invoices: [...data.invoices, inv] };
        if (paidNow) {
          try {
            next = recordPayment(next, { id: newId("p"), invoiceId: inv.id, date: inv.issueDate > TODAY ? TODAY : inv.issueDate, ...paidNow }, TODAY);
          } catch (e) {
            return [(e as Error).message];
          }
        }
        setData(next);
        notify(inv.kind === "client" ? "Facture client ajoutée." : "Dépense ajoutée.");
        return [];
      },
      addPayment(p: Payment, allowOverpayment = false): string[] {
        try {
          setData(recordPayment(data, p, TODAY, { allowOverpayment }));
          notify("Paiement enregistré.");
          return [];
        } catch (e) {
          return [(e as Error).message];
        }
      },
      addMovement(m: Movement): string[] {
        const errors: string[] = [];
        if (!(m.amount > 0)) errors.push("Le montant doit être supérieur à zéro.");
        if (m.type === "transfert" && (!m.toAccountId || m.toAccountId === m.accountId)) errors.push("Choisissez deux comptes différents.");
        if (m.date > TODAY) errors.push("Un mouvement réel ne peut pas être daté dans le futur.");
        if (errors.length) return errors;
        setData({ ...data, movements: [...data.movements, m] });
        notify("Mouvement enregistré.");
        return [];
      },
      updateInvoice(id: string, change: Partial<Invoice>) {
        setData({ ...data, invoices: data.invoices.map((i) => (i.id === id ? { ...i, ...change } : i)) });
        notify("Facture mise à jour.");
      },
      updateRecurrence(r: Recurrence) {
        setData({ ...data, recurrences: data.recurrences.map((x) => (x.id === r.id ? r : x)) });
        notify("Occurrence modifiée, le reste de la série est inchangé.");
      },
      setBudget(category: string, monthly: number) {
        setData({ ...data, budgets: data.budgets.map((b) => (b.category === category ? { ...b, monthly } : b)) });
      },
      setThresholds(warning: number, over: number) {
        setData({ ...data, settings: { ...data.settings, budgetThresholds: { warning, over } } });
      },
      changeCurrency(to: string) {
        const preview = previewBaseCurrencyChange(data, to, TODAY);
        setData(applyBaseCurrencyChange(data, preview, true));
        notify(`Devise de pilotage : ${to}. Les montants d'origine sont conservés.`);
      },
    }),
    [data, notify],
  );

  return { data, base, fmt, actions, toasts };
}

export type Demo = ReturnType<typeof useDemo>;
