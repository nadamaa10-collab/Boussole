import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyBaseCurrencyChange,
  buildDemoData,
  buildEmptyData,
  formatMoney,
  previewBaseCurrencyChange,
  recordPayment,
  validateInvoice,
  type Account,
  type Budget,
  type FinanceData,
  type FxRate,
  type Invoice,
  type Levy,
  type Movement,
  type Payment,
  type Recurrence,
  type SetupInput,
} from "@/lib/finance";

export const TODAY = new Date().toISOString().slice(0, 10);

let seq = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export interface Toast {
  id: number;
  text: string;
  tone: "ok" | "error";
}

const STORAGE_KEY = "boussole-demo-v1";

/** Les données restent dans ce navigateur uniquement (aucun serveur). */
function load(): FinanceData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FinanceData) : null;
  } catch {
    return null;
  }
}

function save(data: FinanceData | null) {
  try {
    if (data) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* stockage indisponible : la démo fonctionne quand même, sans mémoire */
  }
}

/** Gère l'état avant configuration : null tant que l'utilisateur n'a pas démarré. */
export function useDemoRoot() {
  const [data, setData] = useState<FinanceData | null>(load);
  useEffect(() => save(data), [data]);
  return {
    data,
    setData,
    start: (input: SetupInput) => setData(buildEmptyData(input, TODAY)),
    loadExample: () => setData(buildDemoData(TODAY)),
    clear: () => setData(null),
  };
}

export function useDemo(data: FinanceData, setData: (d: FinanceData) => void, clear: () => void) {
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
      /** Efface tout et revient à l'écran de configuration. */
      reset() {
        clear();
      },
      /** Ajoute une facture ; renvoie les erreurs éventuelles (rien n'est ajouté dans ce cas). */
      addInvoice(inv: Invoice, paidNow?: { accountId: string; amount: number; settledAmount?: number }, rates: FxRate[] = []): string[] {
        const withRates = { ...data, rates: [...data.rates, ...rates] };
        const { errors } = validateInvoice(withRates, inv);
        if (errors.length) return errors;
        let next: FinanceData = { ...withRates, invoices: [...data.invoices, inv] };
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
      deleteInvoice(id: string) {
        setData({ ...data, invoices: data.invoices.filter((i) => i.id !== id), payments: data.payments.filter((p) => p.invoiceId !== id) });
        notify("Facture supprimée.");
      },
      addRecurrence(r: Recurrence): string[] {
        const errors: string[] = [];
        if (!r.label.trim()) errors.push("Donnez un nom à cette échéance.");
        if (!(r.amount > 0)) errors.push("Le montant doit être supérieur à zéro.");
        if (errors.length) return errors;
        setData({ ...data, recurrences: [...data.recurrences, r] });
        notify("Échéance récurrente ajoutée.");
        return [];
      },
      updateRecurrence(r: Recurrence, message = "Occurrence modifiée, le reste de la série est inchangé.") {
        setData({ ...data, recurrences: data.recurrences.map((x) => (x.id === r.id ? r : x)) });
        notify(message);
      },
      deleteRecurrence(id: string) {
        setData({ ...data, recurrences: data.recurrences.filter((r) => r.id !== id) });
        notify("Échéance supprimée. Les paiements déjà confirmés sont conservés.");
      },
      upsertBudget(b: Budget) {
        const exists = data.budgets.some((x) => x.category === b.category);
        setData({ ...data, budgets: exists ? data.budgets.map((x) => (x.category === b.category ? b : x)) : [...data.budgets, b] });
      },
      deleteBudget(category: string) {
        setData({ ...data, budgets: data.budgets.filter((b) => b.category !== category) });
      },
      setThresholds(warning: number, over: number) {
        setData({ ...data, settings: { ...data.settings, budgetThresholds: { warning, over } } });
      },
      updateSettings(change: Partial<FinanceData["settings"]>) {
        setData({ ...data, settings: { ...data.settings, ...change } });
      },
      addLevy(l: Levy) {
        setData({ ...data, settings: { ...data.settings, levies: [...data.settings.levies, l] } });
        notify("Prélèvement ajouté.");
      },
      removeLevy(label: string) {
        setData({ ...data, settings: { ...data.settings, levies: data.settings.levies.filter((l) => l.label !== label) } });
      },
      addAccount(a: Account, rates: FxRate[] = []) {
        setData({ ...data, accounts: [...data.accounts, a], rates: [...data.rates, ...rates] });
        notify("Compte ajouté.");
      },
      addRates(rates: FxRate[]) {
        if (!rates.length) return;
        setData({ ...data, rates: [...data.rates, ...rates] });
      },
      /** Change la devise de pilotage, avec les taux saisis par l'utilisateur pour la date du jour. */
      changeCurrency(to: string, extraRates: FxRate[] = []) {
        const withRates = { ...data, rates: [...data.rates, ...extraRates] };
        const preview = previewBaseCurrencyChange(withRates, to, TODAY, { allowReferenceRate: true });
        setData(applyBaseCurrencyChange(withRates, preview, true));
        notify(`Devise de pilotage : ${to}. Les montants d'origine sont conservés.`);
      },
    }),
    [data, notify, setData, clear],
  );

  return { data, base, fmt, actions, toasts, notify };
}

export type Demo = ReturnType<typeof useDemo>;
