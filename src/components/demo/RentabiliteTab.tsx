import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  addMonths,
  breakEven,
  endOfMonth,
  monthKey,
  monthlyRevenueStats,
  profitability,
  runway,
  levySchedule,
  formatDateFr,
  startOfMonth,
} from "@/lib/finance";
import type { Demo } from "./store";
import { TODAY, newId } from "./store";
import { Badge, Card, Empty, Help, Row, inputCls } from "./ui";

const monthLabel = (m: string) => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01`));

export function RentabiliteTab({ demo }: { demo: Demo }) {
  const { data, fmt } = demo;
  const [month, setMonth] = useState(monthKey(TODAY));
  const p = profitability(data, startOfMonth(month), endOfMonth(month));
  const stats = monthlyRevenueStats(data, addDays(TODAY, -365), TODAY);
  const r = runway(data, TODAY);
  const be = breakEven(data, TODAY);
  const shift = (n: number) => setMonth(monthKey(addMonths(startOfMonth(month), n)));
  const byCat = Object.entries(p.chargesByCategory).sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(1, ...byCat.map(([, v]) => v));

  return (
    <div className="space-y-4">
      <p className="rounded-2xl bg-primary/10 p-4 text-sm text-primary">
        Votre activité peut être rentable même si vos clients ne vous ont pas encore payé. C'est pourquoi Boussole distingue ce que vous gagnez (ici) de l'argent que vous avez réellement en banque (onglet Trésorerie).
      </p>

      <div className="flex items-center justify-between">
        <button onClick={() => shift(-1)} aria-label="Mois précédent" className="rounded-full p-2 hover:bg-muted"><ChevronLeft className="size-5" /></button>
        <h3 className="font-display text-2xl first-letter:uppercase">{monthLabel(month)}</h3>
        <button onClick={() => shift(1)} aria-label="Mois suivant" className="rounded-full p-2 hover:bg-muted"><ChevronRight className="size-5" /></button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card tour="profit-detail" title="Le résultat du mois" help="Les revenus et charges sont rattachés au mois où la prestation est réalisée, quelle que soit la date de paiement.">
          <Row label="Revenus de la période (HT)" value={fmt(p.revenue)} />
          <Row label="Charges de la période" value={`− ${fmt(p.charges)}`} />
          <Row label={<>Ce que l'activité gagne <Help>Terme technique : résultat d'exploitation estimé.</Help></>} value={fmt(p.operatingResult)} strong tone={p.operatingResult < 0 ? "danger" : "success"} />
          {p.fxResult !== 0 && <Row label={<>Écarts de change <Help>Différence entre la valeur d'une facture en devise étrangère au jour de la facture et ce qui a vraiment été reçu. Le chiffre d'affaires d'origine n'est pas modifié.</Help></>} value={fmt(p.fxResult)} />}
          {p.interest !== 0 && <Row label="Intérêts d'emprunt" value={`− ${fmt(p.interest)}`} hint="Le capital remboursé n'est pas une charge" />}
          <Row label="Résultat estimé avant prélèvements" value={fmt(p.resultBeforeLevies)} strong />
          {p.levies?.map((l) => <Row key={l.label} label={l.label} value={`− ${fmt(l.amount)}`} hint={`${Math.round(l.rate * 100)} % ${l.base === "chiffre_affaires" ? "du chiffre d'affaires" : "du résultat"} · ${l.source}`} />)}
          {p.resultAfterLevies !== null && <Row label={p.resultLabel} value={fmt(p.resultAfterLevies)} strong tone={p.resultAfterLevies < 0 ? "danger" : undefined} />}
          {p.missing.length > 0 && <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{p.missing.map((m) => <li key={m}>• {m}</li>)}</ul>}
        </Card>

        <Card title="Où part l'argent ce mois-ci">
          {byCat.length === 0 ? (
            <Empty>Aucune charge sur ce mois.</Empty>
          ) : (
            <ul className="space-y-3">
              {byCat.map(([cat, v]) => (
                <li key={cat}>
                  <div className="flex justify-between text-sm"><span>{cat}</span><span className="font-num">{fmt(v)}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(v / maxCat) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
          <p className="mb-1 mt-5 text-sm font-semibold">Revenus du mois</p>
          {p.revenueLines.length === 0 ? <Empty>Aucun revenu rattaché à ce mois.</Empty> : p.revenueLines.map((l) => <Row key={l.sourceId} label={l.label} value={fmt(l.amount)} />)}
        </Card>

        <LevyCard demo={demo} />

        <Card title="Repères de dirigeant" className="lg:col-span-2">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold">Chiffre d'affaires moyen <Help>{stats.basis} Un mois sans données n'est jamais compté comme un mois à zéro.</Help></p>
              {stats.averageRevenue === null ? (
                <p className="mt-1 text-sm text-muted-foreground">Nous avons besoin d'au moins un mois complet pour calculer une moyenne.</p>
              ) : (
                <>
                  <p className="font-num text-2xl">{fmt(stats.averageRevenue)}</p>
                  <p className="text-xs text-muted-foreground">sur {stats.monthsUsed} mois{!stats.representative && " · pas encore représentatif"}</p>
                </>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {stats.months.slice(-6).map((m) => (
                  <span key={m.month} title={m.status} className={`rounded px-1.5 py-0.5 text-[11px] ${m.status === "complet" ? "bg-success/10 text-success" : m.status === "partiel" ? "bg-warning/15" : "bg-muted text-muted-foreground"}`}>
                    {m.month.slice(5)} · {m.status.replace("_", " ")}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold">Autonomie de trésorerie <Help>{r.note}</Help></p>
              <Row label="Sur charges incompressibles" value={r.incompressible.months === null ? "—" : `${r.incompressible.months} mois`} hint={r.incompressible.formula} />
              <Row label="Sur dépenses habituelles" value={r.habituelles.months === null ? "—" : `${r.habituelles.months} mois`} hint={r.habituelles.formula} />
              {r.reasons.map((x) => <p key={x} className="text-xs text-muted-foreground">{x}</p>)}
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold">CA minimum par mois <Help>{be.method}</Help></p>
              <p className="font-num text-2xl">{be.value === null ? "—" : fmt(be.value)}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">{be.hypotheses.map((h) => <li key={h}>• {h}</li>)}</ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/** Échéancier des impôts et cotisations : montant estimé par période, et paiement réel à enregistrer. */
function LevyCard({ demo }: { demo: Demo }) {
  const { data, fmt, base, actions } = demo;
  const [paying, setPaying] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(TODAY);
  const [errors, setErrors] = useState<string[]>([]);
  if (!data.settings.levies.length) {
    return (
      <Card title="Impôts et cotisations" className="lg:col-span-2">
        <Empty>Ajoutez vos impôts et cotisations dans les paramètres (roue dentée) pour voir ce qu'il vous reste vraiment et quand les payer.</Empty>
      </Card>
    );
  }
  const items = levySchedule(data, addDays(TODAY, -120), addDays(TODAY, 400), TODAY);
  const accountId = data.accounts.find((a) => a.currency === base)?.id ?? data.accounts[0]!.id;
  return (
    <Card
      title="Impôts et cotisations à payer"
      help="Chaque période est estimée avec le taux que vous avez saisi et ce qui est enregistré dans Boussole. Une période en cours peut encore augmenter. Enregistrez le montant réellement payé : il est retiré de votre argent disponible."
      className="lg:col-span-2"
    >
      {items.length === 0 ? (
        <Empty>Aucune échéance pour le moment : il faut du chiffre d'affaires saisi sur une période.</Empty>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((d) => {
            const key = `${d.levy.label}@${d.period}`;
            return (
              <li key={key} className="py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-semibold">{d.levy.label}</span> · {d.periodLabel}
                    <span className="block text-xs text-muted-foreground">
                      À payer avant le {formatDateFr(d.dueDate)}{d.provisional ? " · estimation, période en cours" : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-num">{fmt(d.amount)}</span>
                    {d.remaining <= 0 ? (
                      <Badge tone="success">Payé</Badge>
                    ) : d.dueDate < TODAY ? (
                      <Badge tone="danger">En retard</Badge>
                    ) : (
                      <Badge tone="info">À venir</Badge>
                    )}
                    {d.remaining > 0 && paying !== key && (
                      <button onClick={() => { setPaying(key); setAmount(d.remaining); setDate(TODAY); setErrors([]); }} className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-muted">
                        Enregistrer le paiement
                      </button>
                    )}
                  </span>
                </div>
                {d.paid > 0 && d.remaining > 0 && <p className="text-xs text-muted-foreground">Déjà payé : {fmt(d.paid)}</p>}
                {paying === key && (
                  <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl bg-muted/50 p-3">
                    <label className="text-xs font-semibold">
                      Montant réellement payé ({base})
                      <input type="number" step="0.01" className={`${inputCls} mt-1 w-40`} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} />
                    </label>
                    <label className="text-xs font-semibold">
                      Date
                      <input type="date" max={TODAY} className={`${inputCls} mt-1 w-44`} value={date} onChange={(e) => setDate(e.target.value)} />
                    </label>
                    <button
                      onClick={() => {
                        const errs = actions.addMovement({ id: newId("m"), type: "prelevement", date, accountId, amount, levyLabel: d.levy.label, period: d.period, description: `${d.levy.label} — ${d.periodLabel}` });
                        setErrors(errs);
                        if (!errs.length) setPaying(null);
                      }}
                      className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                    >
                      Enregistrer
                    </button>
                    <button onClick={() => setPaying(null)} className="px-2 py-2 text-sm">Annuler</button>
                    {errors.map((e) => <p key={e} className="w-full text-xs text-danger">{e}</p>)}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
