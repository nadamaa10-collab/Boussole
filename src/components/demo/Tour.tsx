import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface TourStep {
  /** Sélecteurs essayés dans l'ordre : le premier élément visible est utilisé (utile pour mobile / ordinateur). */
  target: string[];
  title: string;
  text: string;
  /** Action à faire avant d'afficher l'étape (ex. ouvrir un onglet). */
  onEnter?: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function findTarget(selectors: string[]): HTMLElement | null {
  for (const s of selectors) {
    for (const el of document.querySelectorAll<HTMLElement>(s)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Visite guidée : une souris animée se déplace vers chaque zone, mime un clic,
 * et une bulle explique quoi y renseigner.
 */
export function Tour({ steps, open, onClose }: { steps: TourStep[]; open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [clicking, setClicking] = useState(false);
  const step = steps[i];

  const measure = useCallback(() => {
    if (!step) return;
    const el = findTarget(step.target);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  // À chaque étape : action préalable, défilement vers la cible, puis mesure et « clic ».
  useLayoutEffect(() => {
    if (!open || !step) return;
    step.onEnter?.();
    let t1 = 0;
    let t2 = 0;
    const frame = requestAnimationFrame(() => {
      const el = findTarget(step.target);
      el?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
      t1 = window.setTimeout(() => {
        measure();
        t2 = window.setTimeout(() => {
          setClicking(true);
          window.setTimeout(() => setClicking(false), 450);
        }, reduced() ? 0 : 750);
      }, reduced() ? 50 : 450);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [open, i, step, measure]);

  useEffect(() => {
    if (!open) return;
    const onMove = () => measure();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => Math.min(steps.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, measure, onClose, steps.length]);

  if (!open || !step) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 8;
  // Position de la pointe de la souris : vers le centre-bas de la cible.
  const cx = rect ? rect.left + Math.min(rect.width * 0.5, rect.width - 12) : vw / 2;
  const cy = rect ? rect.top + Math.min(rect.height * 0.6, rect.height - 8) : vh / 2;
  // Bulle sous la cible s'il y a la place, sinon au-dessus.
  const bubbleW = Math.min(340, vw - 24);
  // Sous la cible si la place le permet, sinon au-dessus, sinon collée en bas de l'écran.
  const fitsBelow = !rect || rect.top + rect.height + 230 < vh;
  const fitsAbove = !!rect && rect.top > 250;
  const below = fitsBelow;
  const bubbleTop = !rect ? vh / 2 : fitsBelow ? rect.top + rect.height + 22 : fitsAbove ? rect.top - 22 : vh - 12;
  const bubbleLeft = Math.max(12, Math.min(vw - bubbleW - 12, cx - bubbleW / 2));
  const last = i === steps.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[70]" aria-live="polite">
      {/* Voile avec une découpe autour de la zone expliquée */}
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-2xl ring-2 ring-accent transition-all duration-500 ease-out"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px rgb(20 32 31 / 0.55)" }}
        />
      ) : (
        <div className="fixed inset-0 bg-ink/55" />
      )}
      {/* Clic bloqué ailleurs pendant la visite */}
      <div className="fixed inset-0" onClick={(e) => e.stopPropagation()} />

      {/* La souris */}
      <div
        className="pointer-events-none fixed z-[2] transition-[top,left] duration-700 ease-in-out motion-reduce:transition-none"
        style={{ top: cy, left: cx }}
        aria-hidden="true"
      >
        {clicking && <span className="absolute -left-4 -top-4 size-8 animate-ping rounded-full bg-accent/70" />}
        <svg viewBox="0 0 24 24" className={`size-8 drop-shadow-lg transition-transform duration-150 ${clicking ? "scale-90" : ""}`}>
          <path d="M3 2l7.5 19 2.6-7.4L20.5 11z" fill="white" stroke="rgb(20 32 31)" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </div>

      {/* La bulle */}
      <div
        role="dialog"
        aria-label={`Guide, étape ${i + 1} sur ${steps.length}`}
        className="fixed z-[3] rounded-2xl bg-card p-4 shadow-float transition-all duration-500 ease-out"
        style={{ top: bubbleTop, left: bubbleLeft, width: bubbleW, transform: below ? undefined : "translateY(-100%)" }}
      >
        <p className="text-xs font-semibold text-primary">Étape {i + 1} sur {steps.length}</p>
        <p className="mt-1 font-display text-xl leading-tight">{step.title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
        <div className="mt-3 flex h-1 gap-1" aria-hidden="true">
          {steps.map((_, k) => <span key={k} className={`h-1 flex-1 rounded-full ${k <= i ? "bg-primary" : "bg-muted"}`} />)}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Passer le guide</button>
          <div className="flex gap-2">
            {i > 0 && <button onClick={() => setI(i - 1)} className="rounded-full px-3 py-2 text-sm font-semibold hover:bg-muted">Retour</button>}
            <button autoFocus onClick={() => (last ? onClose() : setI(i + 1))} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              {last ? "C'est parti" : "Suivant"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Mémorise qu'un guide a déjà été vu sur cet appareil. */
export function useTourSeen(key: string) {
  const storageKey = `boussole-guide-${key}`;
  const [seen, setSeenState] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });
  const setSeen = useCallback(() => {
    setSeenState(true);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* rien */
    }
  }, [storageKey]);
  return [seen, setSeen] as const;
}
