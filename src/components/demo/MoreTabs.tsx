import { useMemo, useState } from "react";
import { Download, Plus, Search, Trash2 } from "lucide-react";
import {
  addDays,
  budgetStatus,
  cashFlows,
  convert,
  formatDateFr,
  monthKey,
  occurrences,
  overrideOccurrence,
  findRate,
  type Frequency,
  type Recurrence,
} from "@/lib/finance";
import type { Demo } from "./store";
import { TODAY, newId } from "./store";
import { InvoiceDetail } from "./FacturesTab";
import { Badge, Card, Empty, Errors, Field, Help, PrimaryButton, Segmented, Sheet, inputCls } from "./ui";

/* ------------------------------ Budgets ------------------------------ */

export function BudgetsTab({ demo }: { demo: Demo }) {
  const { data, fmt, base, actions } = demo;
  const rows = budgetStatus(data, monthKey(TODAY));
  const { warning, over } = data.settings.budgetThresholds;
  const [cat, setCat] = useState("");
  const [amt, setAmt] = useState(0);
  const known = [...new Set([...data.invoices.filter((i) => i.kind === "fournisseur").map((i) => i.category), ...data.recurrences.filter((r) => r.kind === "depense").map((r) => r.category)])].filter((c) => !data.budgets.some((b) => b.category === c));
  return (
    <div className="space-y-4">
      <Card tour="budget-add" title="Ajouter un budget mensuel">
        <div className="flex flex-wrap gap-2">
          <input className={`${inputCls} min-w-[160px] flex-1`} list="budget-cats" placeholder="Catégorie (ex. Logiciels)" value={cat} onChange={(e) => setCat(e.target.value)} />
          <datalist id="budget-cats">{known.map((c) => <option key={c} value={c} />)}</datalist>
          <input type="number" min={0} className={`${inputCls} w-36`} placeholder={`Montant (${base})`} value={amt || ""} onChange={(e) => setAmt(Number(e.target.value))} />
          <button disabled={!cat.trim() || !(amt > 0)} onClick={() => { actions.upsertBudget({ category: cat.trim(), monthly: amt }); setCat(""); setAmt(0); }} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">
            <Plus className="size-4" /> Ajouter
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Utilisez le même nom de catégorie que dans vos dépenses pour que le suivi se fasse automatiquement.</p>
      </Card>
      <Card title="Budgets du mois" help="Engagé = dépenses rattachées au mois, payées ou non. Payé = ce qui est déjà sorti du compte.">
        {rows.length === 0 ? (
          <Empty>Ajoutez votre premier budget ci-dessus pour suivre vos dépenses.</Empty>
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
                      <input type="number" min={0} className="w-24 rounded-lg border border-border bg-card px-2 py-1 text-right text-sm" value={b.budget} onChange={(e) => actions.upsertBudget({ category: b.category, monthly: Math.max(0, Number(e.target.value)) })} aria-label={`Budget ${b.category} en ${base}`} />
                      <button onClick={() => actions.deleteBudget(b.category)} aria-label={`Supprimer le budget ${b.category}`} className="p-1"><Trash2 className="size-3.5" /></button>
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
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button data-tour="rec-add" onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="size-4" /> Nouvelle échéance récurrente</button>
      </div>
      {data.recurrences.length === 0 && <Empty>Ajoutez votre loyer, vos abonnements ou votre assurance : ils seront prévus automatiquement dans votre trésorerie.</Empty>}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Échéance récurrente">
        {adding && <RecurrenceForm demo={demo} done={() => setAdding(false)} />}
      </Sheet>
      <p className="text-sm text-muted-foreground">Les prochaines échéances alimentent automatiquement vos prévisions. Elles ne sont considérées comme payées qu'une fois confirmées.</p>
      {data.recurrences.map((r) => {
        const next = occurrences(data, r, addDays(TODAY, -60), addDays(TODAY, 100)).filter((o) => !o.confirmed || o.date >= addDays(TODAY, -7)).slice(0, 4);
        return (
          <Card key={r.id} title={<>{r.label} {r.essential && <Badge>incompressible</Badge>}</>} action={<button onClick={() => actions.deleteRecurrence(r.id)} aria-label={`Supprimer ${r.label}`} className="p-1 text-muted-foreground"><Trash2 className="size-4" /></button>}>
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

function RecurrenceForm({ demo, done }: { demo: Demo; done: () => void }) {
  const { data, base, actions } = demo;
  const [f, setF] = useState({ kind: "depense" as Recurrence["kind"], label: "", amount: 0, frequency: "mensuelle" as Frequency, startDate: addDays(TODAY, 1), category: "", essential: true, accountId: data.accounts[0]!.id, endDate: "" });
  const [errors, setErrors] = useState<string[]>([]);
  const account = data.accounts.find((a) => a.id === f.accountId)!;
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const noRate = account.currency !== base && !findRate(data.rates, account.currency, base, TODAY);
  const submit = () => {
    const errs = actions.addRecurrence({
      id: newId("r"),
      kind: f.kind,
      label: f.label.trim(),
      category: f.category.trim() || f.label.trim(),
      nature: "exploitation",
      amount: f.amount,
      currency: account.currency,
      frequency: f.frequency,
      startDate: f.startDate,
      endDate: f.endDate || undefined,
      accountId: f.accountId,
      essential: f.kind === "depense" && f.essential,
    });
    setErrors(errs);
    if (!errs.length) done();
  };
  return (
    <div className="space-y-3">
      <Segmented label="Type" value={f.kind} onChange={(kind) => set({ kind })} options={[{ value: "depense", label: "Dépense" }, { value: "recette", label: "Recette" }]} />
      <Field label="Nom"><input autoFocus className={inputCls} value={f.label} onChange={(e) => set({ label: e.target.value })} placeholder={f.kind === "depense" ? "Ex. Loyer du bureau" : "Ex. Forfait mensuel client"} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Montant (${account.currency})`}><input type="number" inputMode="decimal" min={0} className={inputCls} value={f.amount || ""} onChange={(e) => set({ amount: Number(e.target.value) })} /></Field>
        <Field label="Fréquence">
          <select className={inputCls} value={f.frequency} onChange={(e) => set({ frequency: e.target.value as Frequency })}>
            <option value="hebdomadaire">Chaque semaine</option>
            <option value="mensuelle">Chaque mois</option>
            <option value="trimestrielle">Chaque trimestre</option>
            <option value="annuelle">Chaque année</option>
          </select>
        </Field>
        <Field label="Prochaine échéance"><input type="date" className={inputCls} value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} /></Field>
        <Field label="Fin (facultatif)"><input type="date" className={inputCls} value={f.endDate} onChange={(e) => set({ endDate: e.target.value })} /></Field>
      </div>
      <Field label="Catégorie" hint="Sert aux budgets. Par défaut, le nom."><input className={inputCls} value={f.category} onChange={(e) => set({ category: e.target.value })} /></Field>
      <Field label="Compte">
        <select className={inputCls} value={f.accountId} onChange={(e) => set({ accountId: e.target.value })}>
          {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
        </select>
      </Field>
      {f.kind === "depense" && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={f.essential} onChange={(e) => set({ essential: e.target.checked })} />
          <span>Charge incompressible <span className="block text-xs text-muted-foreground">À payer même sans aucune vente (loyer, assurance…). Sert à calculer combien de temps vous tenez.</span></span>
        </label>
      )}
      {noRate && <p className="text-xs text-danger">Aucun taux {account.currency} → {base} : ajoutez-le dans les paramètres pour l'inclure dans les totaux.</p>}
      <Errors list={errors} />
      <PrimaryButton onClick={submit}>Ajouter</PrimaryButton>
    </div>
  );
}

/* ------------------------------ Journal ------------------------------ */

const KIND_LABEL = { exploitation: "Activité", investissement: "Investissement", financement: "Apport / retrait / emprunt", interne: "Transfert" };

export function JournalTab({ demo }: { demo: Demo }) {
  const { data, fmt, base, actions } = demo;
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const invoiceOf = (sourceId: string) => data.payments.find((p) => p.id === sourceId)?.invoiceId;
  const recurrencePayment = (sourceId: string) => data.payments.find((p) => p.id === sourceId && p.recurrenceId);
  const movement = (sourceId: string) => data.movements.find((m) => m.id === sourceId);
  const inv = data.invoices.find((i) => i.id === openInvoice);
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
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`font-num text-right ${r.amount > 0 ? "text-success" : ""}`}>
                    {r.amount > 0 ? "+" : "−"}{fmt(Math.abs(r.amount), r.account.currency)}
                    {r.account.currency !== base && r.base !== null && <span className="block text-xs text-muted-foreground">≈ {fmt(Math.abs(r.base))}</span>}
                  </span>
                  {invoiceOf(r.sourceId) ? (
                    <button onClick={() => setOpenInvoice(invoiceOf(r.sourceId)!)} className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-muted">Voir / modifier</button>
                  ) : confirm === r.sourceId ? (
                    <button
                      onClick={() => { if (movement(r.sourceId)) actions.deleteMovement(r.sourceId); else actions.deletePayment(r.sourceId); setConfirm(null); }}
                      className="rounded-full bg-danger px-3 py-1 text-xs font-semibold text-white"
                    >
                      Confirmer
                    </button>
                  ) : movement(r.sourceId) || recurrencePayment(r.sourceId) ? (
                    <button onClick={() => setConfirm(r.sourceId)} aria-label="Supprimer" title={recurrencePayment(r.sourceId) ? "Annuler ce paiement (l'échéance redevient à payer)" : "Supprimer ce mouvement"} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
                      <Trash2 className="size-4" />
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Sheet open={!!inv} onClose={() => setOpenInvoice(null)} title={inv?.party ?? ""}>
        {inv && <InvoiceDetail key={inv.id} demo={demo} inv={inv} onClose={() => setOpenInvoice(null)} />}
      </Sheet>
    </div>
  );
}
