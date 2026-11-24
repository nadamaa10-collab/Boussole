import { useEffect, useId, useState, type ReactNode } from "react";
import { HelpCircle, X } from "lucide-react";

export function Card({ title, help, action, children, className = "", tour }: { title?: ReactNode; help?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; tour?: string }) {
  return (
    <section data-tour={tour} className={`min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          {title && (
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              {title}
              {help && <Help>{help}</Help>}
            </h3>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** Petite aide contextuelle, au survol ou au toucher. */
export function Help({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        aria-label="Explication"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="text-muted-foreground/70 hover:text-foreground"
      >
        <HelpCircle className="size-3.5" />
      </button>
      {open && (
        <span id={id} role="tooltip" className="absolute left-1/2 top-6 z-40 w-64 -translate-x-1/2 rounded-xl bg-ink p-3 text-xs font-normal leading-relaxed text-ink-foreground shadow-float">
          {children}
        </span>
      )}
    </span>
  );
}

export function Big({ children, tone }: { children: ReactNode; tone?: "danger" | "success" | "muted" }) {
  const color = tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : tone === "muted" ? "text-muted-foreground" : "";
  return <p className={`font-num text-3xl tracking-tight sm:text-4xl ${color}`}>{children}</p>;
}

export function Row({ label, value, hint, strong, tone }: { label: ReactNode; value: ReactNode; hint?: ReactNode; strong?: boolean; tone?: "danger" | "success" | "muted" }) {
  const color = tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : tone === "muted" ? "text-muted-foreground" : "";
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 ${strong ? "border-t border-border pt-2.5 font-semibold" : ""}`}>
      <span className="text-sm">
        {label}
        {hint && <span className="block text-xs font-normal text-muted-foreground">{hint}</span>}
      </span>
      <span className={`font-num shrink-0 text-right ${color}`}>{value}</span>
    </div>
  );
}

export type BadgeTone = "neutral" | "danger" | "warning" | "success" | "info";
export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  const cls = {
    neutral: "bg-muted text-muted-foreground",
    danger: "bg-danger/10 text-danger",
    warning: "bg-warning/15 text-[rgb(140_90_10)]",
    success: "bg-success/10 text-success",
    info: "bg-primary/10 text-primary",
  }[tone];
  return <span className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 leading-snug text-xs font-semibold ${cls}`}>{children}</span>;
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-muted p-1 text-sm">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-1.5 font-semibold transition-colors ${o.value === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Panneau modal : feuille du bas sur mobile, fenêtre centrée sur grand écran. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-float sm:max-w-lg sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="rounded-full p-2 hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

/** Ce que veut dire la fiabilité d'un paiement attendu. */
export const CONFIDENCE_HELP: Record<"confirme" | "probable" | "incertain", string> = {
  confirme: "Confirmé : le client s'est engagé sur cette date (virement programmé, accord écrit).",
  probable: "Probable : vous pensez être payé à la date prévue, sans engagement ferme. C'est le choix par défaut.",
  incertain: "Incertain : retard ou impayé possible. Dans le scénario « Prudent », ce paiement est décalé de 30 jours.",
};

export const inputCls =
  "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export function Errors({ list }: { list: string[] }) {
  if (!list.length) return null;
  return (
    <div role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">
      {list.map((e) => (
        <p key={e}>{e}</p>
      ))}
    </div>
  );
}

export function PrimaryButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`w-full rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50 ${rest.className ?? ""}`}>
      {children}
    </button>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">{children}</p>;
}

/**
 * Menu déroulant de catégories, avec « Nouvelle catégorie… » pour en créer une.
 * La nouvelle catégorie est enregistrée et proposée ensuite partout.
 */
export function CategorySelect({
  value,
  onChange,
  options,
  onCreate,
  id,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  onCreate: (name: string) => void;
  id?: string;
  required?: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const list = value && !options.includes(value) ? [...options, value] : options;
  if (creating) {
    const ok = () => {
      const n = name.trim();
      if (!n) return;
      onCreate(n);
      onChange(n);
      setCreating(false);
      setName("");
    };
    return (
      <div className="flex gap-2">
        <input
          autoFocus
          id={id}
          className={inputCls}
          placeholder="Nom de la nouvelle catégorie"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), ok())}
        />
        <button type="button" onClick={ok} className="rounded-xl bg-primary px-4 font-semibold text-primary-foreground">OK</button>
        <button type="button" onClick={() => setCreating(false)} className="px-2 text-sm text-muted-foreground">Annuler</button>
      </div>
    );
  }
  return (
    <select
      id={id}
      className={inputCls}
      value={value}
      onChange={(e) => (e.target.value === "__new__" ? setCreating(true) : onChange(e.target.value))}
    >
      {!value && <option value="">{required ? "Choisir une catégorie (obligatoire)…" : "Choisir une catégorie…"}</option>}
      {list.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
      <option value="__new__">＋ Nouvelle catégorie…</option>
    </select>
  );
}
