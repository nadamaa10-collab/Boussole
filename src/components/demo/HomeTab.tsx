import { AlertTriangle, ArrowDownLeft, ArrowUpRight, BellRing, CalendarClock, PiggyBank, TrendingDown, Wallet } from "lucide-react";
import {
  cashPosition,
  commitments,
  endOfMonth,
  forecast,
  formatDateFr,
  monthKey,
  priorityActions,
  profitability,
  startOfMonth,
} from "@/lib/finance";
import type { Demo } from "./store";
import { TODAY } from "./store";
import { Badge, Big, Card, Empty, Help, Row } from "./ui";

const ICONS = {
  relance: BellRing,
  echeance_client: ArrowDownLeft,
  fournisseur: ArrowUpRight,
  risque_tresorerie: TrendingDown,
  budget: PiggyBank,
  depense_inhabituelle: AlertTriangle,
};

export function HomeTab({ demo, goTo, onAdd }: { demo: Demo; goTo: (tab: string) => void; onAdd: () => void }) {
  const { data, fmt, base } = demo;
  const pos = cashPosition(data, TODAY);
  const { receivables, payables } = commitments(data, TODAY);
  const horizons = [7, 30, 90].map((days) => ({ days, f: forecast(data, { today: TODAY, days }) }));
  const f30 = horizons[1]!.f;
  const month = monthKey(TODAY);
  const p = profitability(data, startOfMonth(month), endOfMonth(month));
  const actions = priorityActions(data, TODAY);
  const upcoming = f30.events.slice(0, 5);
  const monthName = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(new Date(TODAY));

  const isEmpty = data.invoices.length === 0 && data.recurrences.length === 0 && data.movements.length === 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {isEmpty && (
        <Card title="Pour bien démarrer" className="border-primary/30 bg-primary/5 lg:col-span-2">
          <ol className="grid gap-2 sm:grid-cols-3">
            {[
              { n: 1, t: "Vos factures clients en attente", d: "Ce qu'on vous doit, avec la date prévue de paiement.", a: onAdd },
              { n: 2, t: "Vos dépenses à venir", d: "Factures fournisseurs non payées.", a: onAdd },
              { n: 3, t: "Vos charges récurrentes", d: "Loyer, abonnements, assurance…", a: () => goTo("recurrences") },
            ].map((x) => (
              <li key={x.n}>
                <button onClick={x.a} className="h-full w-full rounded-xl bg-card p-3 text-left hover:ring-2 hover:ring-primary/30">
                  <span className="font-num text-2xl text-accent">{x.n}</span>
                  <span className="block font-semibold">{x.t}</span>
                  <span className="text-sm text-muted-foreground">{x.d}</span>
                </button>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-muted-foreground">Dès la première ligne, vos prévisions de trésorerie et votre rentabilité se calculent toutes seules.</p>
        </Card>
      )}
      {/* 1. Argent disponible */}
      <Card
        title={<><Wallet className="size-4" /> Mon argent disponible aujourd'hui</>}
        help="L'argent réellement présent sur vos comptes. Les factures que vos clients n'ont pas encore payées n'y sont jamais ajoutées."
        className="lg:col-span-2"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {pos.total === null ? <Big tone="muted">Taux manquant</Big> : <Big tone={pos.total < 0 ? "danger" : undefined}>{fmt(pos.total)}</Big>}
            <p className="mt-1 text-xs text-muted-foreground">
              Mis à jour le {formatDateFr(pos.lastUpdate)} · saisie manuelle
              {pos.usesEstimatedRates && " · contre-valeurs estimées (taux de démonstration fictifs)"}
            </p>
          </div>
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-3">
            {pos.accounts.map((a) => (
              <div key={a.account.id} className="rounded-xl bg-muted/60 px-3 py-2">
                <p className="text-xs text-muted-foreground">{a.account.name}</p>
                <p className="font-num">{fmt(a.balance, a.account.currency)}</p>
                {a.account.currency !== base && a.baseValue !== null && <p className="text-xs text-muted-foreground">≈ {fmt(a.baseValue)}</p>}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* 2. Ce qui m'attend */}
      <Card
        title={<><CalendarClock className="size-4" /> Ce qui m'attend</>}
        help="Prévisions calculées jour par jour à partir des dates de paiement renseignées. Si un client paie plus tard, la prévision change."
        action={<button onClick={() => goTo("tresorerie")} className="text-sm font-semibold text-primary">Voir le détail</button>}
      >
        <div className="grid grid-cols-3 gap-2 text-center">
          {horizons.map(({ days, f }) => (
            <div key={days} className={`min-w-0 rounded-xl px-1.5 py-2.5 sm:px-2.5 ${f.min && f.min.balance < 0 ? "bg-danger/10" : "bg-muted/60"}`}>
              <p className="text-xs text-muted-foreground">Dans {days} jours</p>
              <p className="font-num text-sm sm:text-lg">{f.available ? fmt(f.end) : "—"}</p>
              {f.min && f.min.balance < 0 && <p className="text-[11px] font-semibold leading-tight text-danger">sous 0 en chemin</p>}
            </div>
          ))}
        </div>
        {f30.alert && (
          <p className="mt-3 flex gap-2 rounded-xl bg-danger/10 p-3 text-sm text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {f30.alert}
          </p>
        )}
        <div className="mt-3">
          <Row label="À recevoir de vos clients" value={receivables.total === null ? "—" : fmt(receivables.total)} hint={receivables.lateTotal ? `dont ${fmt(receivables.lateTotal)} en retard` : undefined} />
          <Row label="À payer à vos fournisseurs" value={payables.total === null ? "—" : fmt(payables.total)} />
        </div>
        <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prochains mouvements</p>
        {upcoming.length === 0 ? (
          <Empty>Aucun mouvement prévu dans les 30 prochains jours.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {upcoming.map((e) => (
              <li key={e.sourceId} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{e.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {e.status === "en_retard" ? "en retard" : formatDateFr(e.date)}
                    {e.estimatedFx && ` · ${fmt(e.original.amount, e.original.currency)} (taux estimé)`}
                  </span>
                </span>
                <span className={`font-num shrink-0 ${e.amount > 0 ? "text-success" : ""}`}>{e.amount > 0 ? "+" : "−"}{fmt(Math.abs(e.amount))}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 3. Actions prioritaires */}
      <Card title={<><BellRing className="size-4" /> À faire en priorité</>} help="Classées par urgence, puis par montant en jeu.">
        {actions.length === 0 ? (
          <Empty>Rien d'urgent aujourd'hui.</Empty>
        ) : (
          <ul className="space-y-2">
            {actions.map((a, i) => {
              const Icon = ICONS[a.kind];
              return (
                <li key={i} className="flex gap-3 rounded-xl bg-muted/50 p-3">
                  <Icon className={`mt-0.5 size-4 shrink-0 ${a.severity === 1 ? "text-danger" : a.severity === 2 ? "text-warning" : "text-muted-foreground"}`} />
                  <span className="min-w-0 text-sm">
                    <span className="flex flex-wrap items-center gap-2 font-semibold">
                      {a.title}
                      {a.severity === 1 && <Badge tone="danger">Urgent</Badge>}
                    </span>
                    <span className="block text-muted-foreground">{a.detail}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* 4. Rentabilité du mois */}
      <Card
        title={<>Ce que mon activité gagne en {monthName}</>}
        help="Votre résultat mesure ce que votre activité a gagné, même si vos clients n'ont pas encore payé. Votre trésorerie mesure l'argent réellement disponible. Terme technique : résultat d'exploitation."
        action={<button onClick={() => goTo("rentabilite")} className="text-sm font-semibold text-primary">Détail</button>}
        className="lg:col-span-2"
      >
        <div className="grid gap-x-8 sm:grid-cols-2">
          <div>
            <Row label="Chiffre d'affaires du mois (HT)" value={fmt(p.revenue)} hint="Prestations réalisées ce mois-ci, payées ou non" />
            <Row label="Charges du mois" value={`− ${fmt(p.charges)}`} />
            <Row label="Ce que l'activité gagne" value={fmt(p.operatingResult)} strong tone={p.operatingResult < 0 ? "danger" : "success"} />
          </div>
          <div>
            {p.fxResult !== 0 && <Row label="Écarts de change" value={fmt(p.fxResult)} />}
            {p.levies?.map((l) => <Row key={l.label} label={l.label} value={`− ${fmt(l.amount)}`} hint={`${Math.round(l.rate * 100)} % · ${l.source}`} />)}
            <Row label={p.resultLabel} value={fmt(p.resultAfterLevies ?? p.resultBeforeLevies)} strong />
          </div>
        </div>
        {f30.firstNegative && p.operatingResult > 0 && (
          <p className="mt-3 rounded-xl bg-primary/10 p-3 text-sm text-primary">
            Votre mois est rentable, mais votre trésorerie passe sous zéro le {formatDateFr(f30.firstNegative.date)} : vos clients paient après vos échéances. C'est exactement ce que Boussole vous aide à anticiper.
          </p>
        )}
      </Card>
    </div>
  );
}
