import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { openStore, type Store } from "./persist";
import {
  applyBaseCurrencyChange,
  buildDemoData,
  buildEmptyData,
  migrateData,
  addDays,
  occurrences,
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

/* ---------------------- Sauvegarde et brouillons ---------------------- */

export interface Drafts {
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown): void;
}

export const DraftContext = createContext<Drafts>({ get: () => undefined, set: () => {} });

/**
 * Un état de formulaire gardé en brouillon : il survit à un rechargement de la page.
 * `clear()` l'efface une fois le formulaire validé.
 */
export function useDraft<T extends object>(key: string | null, initial: T): [T, (v: T) => void, () => void] {
  const drafts = useContext(DraftContext);
  const [value, setValue] = useState<T>(() => (key ? { ...initial, ...(drafts.get<T>(key) ?? {}) } : initial));
  const set = (v: T) => {
    setValue(v);
    if (key) drafts.set(key, v);
  };
  const clear = () => {
    if (key) drafts.set(key, undefined);
  };
  return [value, set, clear];
}

/** Gère le chargement, la sauvegarde et l'état avant configuration (null tant que rien n'est démarré). */
export function useDemoRoot() {
  const [store, setStore] = useState<Store | null>(null);
  const [data, setData] = useState<FinanceData | null>(null);
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const [, refresh] = useState(0);
  const loaded = useRef(false);

  useEffect(() => {
    let alive = true;
    void openStore().then((s) => {
      if (!alive) return;
      setData(s.initial.data ? migrateData(s.initial.data) : null);
      setDrafts(s.initial.drafts ?? {});
      s.onStatus(() => refresh((x) => x + 1));
      setStore(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Chaque changement est enregistré (regroupé par le module de sauvegarde).
  useEffect(() => {
    if (!store) return;
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    store.save({ data, drafts });
  }, [store, data, drafts]);

  // Onglet masqué ou fermé : on écrit tout de suite.
  useEffect(() => {
    if (!store) return;
    const onHide = () => document.visibilityState === "hidden" && store.flushNow();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", store.flushNow);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", store.flushNow);
    };
  }, [store]);

  const draftApi = useMemo<Drafts>(
    () => ({
      get: <T,>(key: string) => drafts[key] as T | undefined,
      set: (key: string, value: unknown) =>
        setDrafts((d) => {
          const next = { ...d };
          if (value === undefined) delete next[key];
          else next[key] = value;
          return next;
        }),
    }),
    [drafts],
  );

  return {
    ready: !!store,
    storage: store?.kind ?? "aucun",
    saving: store?.status.pending ?? false,
    saveError: store?.status.error ?? null,
    data,
    setData,
    drafts,
    draftApi,
    start: (input: SetupInput) => {
      setData(buildEmptyData(input, TODAY));
      setDrafts((d) => {
        const { setup: _s, ...rest } = d;
        return rest;
      });
    },
    loadExample: () => setData(buildDemoData(TODAY)),
    clear: () => {
      setData(null);
      setDrafts({});
    },
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
        notify(inv.kind === "client" ? "Facture ajoutée : retrouvez-la dans Factures › Recettes." : "Dépense ajoutée : retrouvez-la dans Factures › Dépenses.");
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
      /** Remplace une facture existante après validation ; ses paiements sont conservés. */
      saveInvoice(inv: Invoice, rates: FxRate[] = []): string[] {
        const withRates = { ...data, rates: [...data.rates, ...rates] };
        const { errors } = validateInvoice(withRates, inv);
        if (errors.length) return errors;
        const paid = data.payments.filter((p) => p.invoiceId === inv.id).reduce((s, p) => s + (p.settledAmount ?? p.amount), 0);
        if (inv.amountHT + inv.vatAmount < paid - 0.005) {
          return [`Le montant ne peut pas être inférieur à ce qui a déjà été payé (${formatMoney(paid, inv.currency, data.settings.locale)}). Supprimez d'abord un paiement si besoin.`];
        }
        setData({ ...withRates, invoices: data.invoices.map((i) => (i.id === inv.id ? inv : i)) });
        notify("Modifications enregistrées.");
        return [];
      },
      /** Annule tous les paiements d'une facture : elle redevient « à payer » (ou « en retard » si l'échéance est passée). */
      markUnpaid(invoiceId: string, dueDate?: string) {
        setData({
          ...data,
          payments: data.payments.filter((p) => p.invoiceId !== invoiceId),
          invoices: dueDate ? data.invoices.map((i) => (i.id === invoiceId ? { ...i, dueDate } : i)) : data.invoices,
        });
        notify("Marquée comme non payée. Votre argent disponible a été recalculé.");
      },
      deletePayment(id: string) {
        setData({ ...data, payments: data.payments.filter((p) => p.id !== id) });
        notify("Paiement supprimé.");
      },
      deleteMovement(id: string) {
        setData({ ...data, movements: data.movements.filter((m) => m.id !== id) });
        notify("Mouvement supprimé.");
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
      /**
       * Modifie toute la série. Si sa date de départ ou sa fréquence change, les paiements
       * déjà confirmés sont rattachés aux occurrences correspondantes de la nouvelle série
       * (1re avec 1re, 2e avec 2e…), pour ne jamais les compter deux fois.
       */
      saveRecurrence(r: Recurrence): string[] {
        const errors: string[] = [];
        if (!r.label.trim()) errors.push("Donnez un nom à cette échéance.");
        if (!(r.amount > 0)) errors.push("Le montant doit être supérieur à zéro.");
        if (errors.length) return errors;
        const old = data.recurrences.find((x) => x.id === r.id);
        let payments = data.payments;
        let next = r;
        if (old && (old.startDate !== r.startDate || old.frequency !== r.frequency)) {
          const far = addDays(TODAY, 3650);
          const keys = (x: Recurrence) => occurrences({ payments: [] }, { ...x, overrides: undefined, endDate: undefined }, "1900-01-01", far).map((o) => o.key);
          const oldKeys = keys(old);
          const newKeys = keys(r);
          payments = payments.map((p) =>
            p.recurrenceId === r.id && p.occurrenceDate ? { ...p, occurrenceDate: newKeys[oldKeys.indexOf(p.occurrenceDate)] ?? p.occurrenceDate } : p,
          );
          next = { ...r, overrides: undefined };
        }
        setData({ ...data, payments, recurrences: data.recurrences.map((x) => (x.id === r.id ? next : x)) });
        notify("Échéance récurrente modifiée.");
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
      addCategory(kind: "depense" | "recette", name: string) {
        const c = data.settings.customCategories ?? { depense: [], recette: [] };
        if (c[kind].some((x) => x.toLocaleLowerCase("fr") === name.toLocaleLowerCase("fr"))) return;
        setData({ ...data, settings: { ...data.settings, customCategories: { ...c, [kind]: [...c[kind], name] } } });
      },
      addLevy(l: Levy) {
        setData({ ...data, settings: { ...data.settings, levies: [...data.settings.levies, l] } });
        notify("Prélèvement ajouté.");
      },
      removeLevy(label: string) {
        setData({ ...data, settings: { ...data.settings, levies: data.settings.levies.filter((l) => l.label !== label) } });
      },
      updateAccount(id: string, change: Partial<Account>) {
        setData({ ...data, accounts: data.accounts.map((a) => (a.id === id ? { ...a, ...change } : a)) });
        notify("Compte mis à jour : tous les calculs repartent de ce solde.");
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
