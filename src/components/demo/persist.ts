import type { FinanceData } from "@/lib/finance";

/**
 * Sauvegarde des données de la démo.
 * 1. Sur le compte Claude de la personne (capacité `db` de la page publiée sur claude.ai) :
 *    survit aux rechargements et se retrouve sur un autre appareil. Espace privé par personne.
 * 2. Sinon, dans le navigateur (localStorage), quand il est disponible.
 * 3. Sinon, rien : l'interface le dit clairement.
 * Une copie locale est toujours tenue quand c'est possible, pour un rechargement instantané.
 */

export type StorageKind = "compte" | "appareil" | "aucun";

export interface Saved {
  data: FinanceData | null;
  drafts: Record<string, unknown>;
}

interface DocRef {
  get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
  set(data: Record<string, unknown>): Promise<void>;
}

const LOCAL_KEY = "boussole-demo-v1";
const DRAFTS_KEY = "boussole-brouillons-v1";

function localAvailable(): boolean {
  try {
    const k = "__boussole_test__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function readLocal(): Saved {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const drafts = localStorage.getItem(DRAFTS_KEY);
    return { data: raw ? (JSON.parse(raw) as FinanceData) : null, drafts: drafts ? JSON.parse(drafts) : {} };
  } catch {
    return { data: null, drafts: {} };
  }
}

function writeLocal(s: Saved) {
  try {
    if (s.data) localStorage.setItem(LOCAL_KEY, JSON.stringify(s.data));
    else localStorage.removeItem(LOCAL_KEY);
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(s.drafts));
  } catch {
    /* indisponible */
  }
}

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

/** Le document privé de la personne sur son compte Claude, ou null hors de claude.ai. */
async function accountDoc(): Promise<DocRef | null> {
  type W = { claude?: { use(name: string): Promise<unknown> } };
  // Dans le cadre de claude.ai, l'accès peut arriver un instant après le chargement.
  const inFrame = window.self !== window.top;
  for (let i = 0; inFrame && !(window as unknown as W).claude?.use && i < 15; i++) await new Promise((r) => setTimeout(r, 100));
  const claude = (window as unknown as W).claude;
  if (!claude?.use) return null;
  try {
    const [db, user] = (await withTimeout(Promise.all([claude.use("db"), claude.use("user")]), 6000)) ?? [null, null];
    if (!db || !user) return null;
    const id = await (user as { id(): Promise<string | null> }).id();
    if (!id) return null;
    return (db as { doc(path: string): DocRef }).doc(`data/users/${id}/boussole`);
  } catch {
    return null;
  }
}

export interface Store {
  kind: StorageKind;
  initial: Saved;
  /** Enregistre (regroupé : une écriture à la fois, après une courte pause). */
  save(s: Saved): void;
  /** Résolu quand plus aucune écriture n'est en attente. */
  status: { pending: boolean; error: string | null };
  onStatus(fn: () => void): void;
  /** Écrit tout de suite ce qui attend (quand l'onglet passe en arrière-plan). */
  flushNow(): void;
}

export async function openStore(): Promise<Store> {
  const local = localAvailable();
  const doc = await accountDoc();
  let initial: Saved = local ? readLocal() : { data: null, drafts: {} };

  if (doc) {
    try {
      const snap = await withTimeout(doc.get(), 8000);
      if (snap?.exists) {
        const body = snap.data() ?? {};
        const data = typeof body.state === "string" ? (JSON.parse(body.state) as FinanceData) : null;
        const drafts = typeof body.drafts === "string" ? JSON.parse(body.drafts) : {};
        initial = { data, drafts };
      }
    } catch {
      /* on garde la copie locale */
    }
  }

  const listeners = new Set<() => void>();
  const status = { pending: false, error: null as string | null };
  const emit = () => listeners.forEach((f) => f());

  let latest: Saved | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writing = false;

  const flush = async () => {
    if (!doc || writing || !latest) return;
    writing = true;
    const s = latest;
    latest = null;
    try {
      await doc.set({ state: s.data ? JSON.stringify(s.data) : "", drafts: JSON.stringify(s.drafts), savedAt: new Date().toISOString() });
      status.error = null;
    } catch (e) {
      status.error = (e as { code?: string }).code === "quota_exceeded" ? "Espace de sauvegarde plein." : "Sauvegarde sur le compte impossible pour le moment.";
      latest = latest ?? s; // on réessaiera au prochain changement
    }
    writing = false;
    status.pending = !!latest;
    emit();
    if (latest) timer = setTimeout(flush, 1500);
  };

  return {
    kind: doc ? "compte" : local ? "appareil" : "aucun",
    initial,
    status,
    onStatus: (fn) => listeners.add(fn),
    flushNow() {
      clearTimeout(timer);
      void flush();
    },
    save(s) {
      if (local) writeLocal(s);
      if (!doc) return;
      latest = s;
      status.pending = true;
      emit();
      clearTimeout(timer);
      timer = setTimeout(flush, 700);
    },
  };
}
