import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import {
  addDays,
  budgetStatus,
  cashFlows,
  convert,
  formatDateFr,
  monthKey,
  occurrences,
  overrideOccurrence,
  type Recurrence,
} from "@/lib/finance";
import type { Demo } from "./store";
import { TODAY, newId } from "./store";
import { Badge, Card, Empty, Errors, Field, Help, PrimaryButton, Segmented, Sheet, inputCls } from "./ui";

/* ------------------------------ Budgets ------------------------------ */

export function BudgetsTab({ demo }: { demo: Demo }) {
  const { data, fmt, base, actions } = demo;
  const rows = budgetStatus(data, monthKey(TODAY));
  const { warning, over } = data.settings.budgetThresholds;
  return (
    <div className="space-y-4">
      <Card title="Budgets du mois" help="Engagé = dépenses rattachées au mois, payées ou non. Payé = ce qui est déjà sorti du compte.">
        {rows.length === 0 ? (
          <Empty>Ajoutez votre premier budget pour suivre vos dépenses.</Empty>
        ) : (
          <ul className="space-y-5">
            {rows.map((b) => {
              const color = b.level === "depasse" ? "bg-danger" : b.level === "alerte" ? "bg-warning" : "bg-success";
              return (
                <li key={b.category}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{b.category}</span>
                    <span className="flex items-center gap-2">
                      {b.level !== "normal" && <Badge tone={b.level === "depasse" ? "danger" : "warning"}>{b.level === "depasse" ? "Dépassé" : "Attention"}</Badge>}
                      <span className="font-num text-sm">{b.percent} %</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 rounded-full bg-muted">
                    <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${Math.min(100, b.percent)}%` }} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>Engagé {fmt(b.engaged)} · payé {fmt(b.paid)} · {b.remaining >= 0 ? `reste ${fmt(b.remaining)}` : `dépassement ${fmt(-b.remaining)}`}</span>
                    <label className="flex items-center gap-1">
                      Budget
                      <input type="number" min={0} className="w-24 rounded-lg border border-border bg-card px-2 py-1 text-right text-sm" value={b.budget} onChange={(e) => actions.setBudget(b.category, Math.max(0, Number(e.target.value)))} aria-label={`Budget ${b.category} en ${base}`} />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card title="Seuils d'alerte">
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Attention à partir de ${Math.round(warning * 100)} %`}>
            <input type="range" min={50} max={99} value={Math.round(warning * 100)} onChange={(e) => actions.setThresholds(Number(e.target.value) / 100, over)} className="w-full accent-[rgb(var(--warning))]" />
          </Field>
          <Field label={`Dépassé au-delà de ${Math.round(over * 100)} %`}>
            <input type="range" min={100} max={150} value={Math.round(over * 100)} onChange={(e) => actions.setThresholds(warning, Number(e.target.value) / 100)} className="w-full accent-[rgb(var(--danger))]" />
          </Field>
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------- Récurrences ---------------------------- */

export function RecurrencesTab({ demo }: { demo: Demo }) {
  const { data, fmt, actions } = demo;
  const [edit, setEdit] = useState<{ r: Recurrence; key: string; amount: number; date: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Les prochaines échéances alimentent automatiquement vos prévisions. Elles ne sont considérées comme payées qu'une fois confirmées.</p>
      {data.recurrences.map((r) => {
        const next = occurrences(data, r, addDays(TODAY, -60), addDays(TODAY, 100)).filter((o) => !o.confirmed || o.date >= addDays(TODAY, -7)).slice(0, 4);
        return (
          <Card key={r.id} title={<>{r.label} {r.essential && <Badge>incompressible</Badge>}</>}>
            <p className="text-sm text-muted-foreground">{fmt(r.amount, r.currency)} · {r.frequency} · {r.category}</p>
            <ul className="mt-2 divide-y divide-border">
              {next.map((o) => (
                <li key={o.key} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    {formatDateFr(o.date)}
                    {o.date !== o.key && <span className="text-muted-foreground"> (au lieu du {formatDateFr(o.key)})</span>}
                    {" · "}<span className="font-num">{fmt(o.amount, r.currency)}</span>
                  </span>
                  {o.confirmed ? (
                    <Badge tone="success">Payé</Badge>
                  ) : (
                    <span className="flex gap-2">
                      {o.date <= TODAY ? <Badge tone="danger">À confirmer</Badge> : <Badge tone="info">Prévu</Badge>}
                      {o.date <= TODAY && (
                        <button
                          className="text-sm font-semibold text-primary"
                          onClick={() => setErrors(actions.addPayment({ id: newId("p"), recurrenceId: r.id, occurrenceDate: o.key, accountId: r.accountId, date: TODAY, amount: o.amount }))}
                        >
                          Confirmer le paiement
                        </button>
                      )}
                      <button className="text-sm font-semibold text-primary" onClick={() => setEdit({ r, key: o.key, amount: o.amount, date: o.date })}>Modifier</button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
      <Errors list={errors} />
      <Sheet open={!!edit} onClose={() => setEdit(null)} title="Modifier cette échéance">
        {edit && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Seule cette occurrence est modifiée. Le reste de la série « {edit.r.label} » ne change pas.</p>
            <Field label={`Montant (${edit.r.currency})`}><input type="number" className={inputCls} value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: Number(e.target.value) })} /></Field>
            <Field label="Date"><input type="date" className={inputCls} value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} /></Field>
            <PrimaryButton onClick={() => { actions.updateRecurrence(overrideOccurrence(edit.r, edit.key, { amount: edit.amount, date: edit.date })); setEdit(null); }}>Enregistrer</PrimaryButton>
            <button className="w-full py-2 text-sm font-semibold text-danger" onClick={() => { actions.updateRecurrence(overrideOccurrence(edit.r, edit.key, { skip: true })); setEdit(null); }}>Annuler cette occurrence</button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

/* ------------------------------ Journal ------------------------------ */

const KIND_LABEL = { exploitation: "Activité", investissement: "Investissement", financement: "Apport / retrait / emprunt", interne: "Transfert" };

export function JournalTab({ demo }: { demo: Demo }) {
  const { data, fmt, base } = demo;
  const [q, setQ] = useState("");
  const [dir, setDir] = useState<"tout" | "entrees" | "sorties">("tout");
  const [acc, setAcc] = useState("");
  const accounts = new Map(data.accounts.map((a) => [a.id, a]));

  const rows = useMemo(
    () =>
      cashFlows(data)
        .filter((f) => f.date <= TODAY)
        .map((f) => {
          const a = accounts.get(f.accountId)!;
          return { ...f, account: a, base: convert(f.amount, a.currency, base, data.rates, f.date)?.value ?? null, inOpening: f.date <= a.openingDate };
        })
        .filter((f) => (dir === "tout" ? true : dir === "entrees" ? f.amount > 0 : f.amount < 0))
        .filter((f) => !acc || f.accountId === acc)
        .filter((f) => !q || `${f.label} ${f.account.name}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.date.localeCompare(a.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, q, dir, acc, base],
  );

  const exportCsv = () => {
    const head = ["Date", "Libellé", "Type", "Compte", "Devise", "Montant", `Contre-valeur ${base}`, "Inclus dans le solde de départ"];
    const lines = rows.map((r) => [r.date, r.label, KIND_LABEL[r.kind], r.account.name, r.account.currency, r.amount.toFixed(2), r.base?.toFixed(2) ?? "", r.inOpening ? "oui" : "non"]);
    const csv = [head, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `boussole-journal-${TODAY}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input className={`${inputCls} pl-9`} placeholder="Rechercher un client, un fournisseur…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className={`${inputCls} w-auto`} value={acc} onChange={(e) => setAcc(e.target.value)} aria-label="Compte">
          <option value="">Tous les comptes</option>
          {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <Segmented label="Sens" value={dir} onChange={setDir} options={[{ value: "tout", label: "Tout" }, { value: "entrees", label: "Entrées" }, { value: "sorties", label: "Sorties" }]} />
        <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"><Download className="size-4" /> CSV</button>
      </div>
      <Card title={<>Mouvements réels <Help>Uniquement l'argent qui a réellement bougé. Les mouvements antérieurs au solde de départ d'un compte y sont déjà inclus : ils sont affichés mais ne sont pas recomptés.</Help></>}>
        {rows.length === 0 ? <Empty>Aucun mouvement ne correspond.</Empty> : (
          <ul className="divide-y divide-border">
            {rows.map((r, i) => (
              <li key={`${r.sourceId}-${i}`} className={`flex items-center justify-between gap-3 py-2.5 text-sm ${r.inOpening ? "opacity-60" : ""}`}>
                <span className="min-w-0">
                  <span className="block truncate">{r.label}</span>
                  <span className="text-xs text-muted-foreground">{formatDateFr(r.date)} · {r.account.name} · {KIND_LABEL[r.kind]}{r.inOpening && " · déjà dans le solde de départ"}</span>
                </span>
                <span className={`font-num shrink-0 text-right ${r.amount > 0 ? "text-success" : ""}`}>
                  {r.amount > 0 ? "+" : "−"}{fmt(Math.abs(r.amount), r.account.currency)}
                  {r.account.currency !== base && r.base !== null && <span className="block text-xs text-muted-foreground">≈ {fmt(Math.abs(r.base))}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
