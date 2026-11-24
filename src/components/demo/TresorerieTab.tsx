import { useMemo, useState } from "react";
import { AlertTriangle, FlaskConical } from "lucide-react";
import {
  addDays,
  cashFlowStatement,
  forecast,
  formatDateFr,
  monthKey,
  startOfMonth,
  type Forecast,
  type ForecastPoint,
  type SimulationEvent,
} from "@/lib/finance";
import type { Demo } from "./store";
import { TODAY } from "./store";
import { Badge, Card, Field, Help, Row, Segmented, inputCls } from "./ui";

function Chart({ f, fmt, selected, onSelect }: { f: Forecast; fmt: (v: number) => string; selected: string | null; onSelect: (d: string) => void }) {
  const W = 720;
  const H = 240;
  const P = { l: 8, r: 8, t: 16, b: 26 };
  const pts = f.points;
  const vals = pts.map((p) => p.balance);
  const max = Math.max(...vals, 0);
  const min = Math.min(...vals, 0);
  const span = max - min || 1;
  const x = (i: number) => P.l + (i / Math.max(1, pts.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + ((max - v) / span) * (H - P.t - P.b);
  // Courbe en escalier : le solde change le jour du mouvement, pas progressivement.
  let d = `M ${x(0)} ${y(vals[0]!)}`;
  pts.forEach((p, i) => {
    if (i === 0) return;
    d += ` H ${x(i)} V ${y(p.balance)}`;
  });
  const area = `${d} V ${y(min)} H ${x(0)} Z`;
  const zero = y(0);
  const step = Math.max(1, Math.round(pts.length / 6));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-pan-y select-none" role="img" aria-label="Évolution prévue du solde">
      <defs>
        <clipPath id="above"><rect x="0" y="0" width={W} height={zero} /></clipPath>
        <clipPath id="below"><rect x="0" y={zero} width={W} height={H} /></clipPath>
      </defs>
      <path d={area} className="fill-primary/10" clipPath="url(#above)" />
      <path d={area} className="fill-danger/15" clipPath="url(#below)" />
      <line x1={P.l} x2={W - P.r} y1={zero} y2={zero} className="stroke-foreground/40" strokeDasharray="4 4" />
      <path d={d} fill="none" className="stroke-primary" strokeWidth={2.5} clipPath="url(#above)" />
      <path d={d} fill="none" className="stroke-danger" strokeWidth={2.5} clipPath="url(#below)" />
      {pts.map((p, i) =>
        p.events.length ? (
          <g key={p.date}>
            <circle
              cx={x(i)}
              cy={y(p.balance)}
              r={selected === p.date ? 7 : 5}
              className={`${p.events.some((e) => e.status !== "prevu" || e.confidence === "incertain") ? "fill-card stroke-warning" : "fill-card stroke-primary"} cursor-pointer`}
              strokeWidth={2.5}
              strokeDasharray={p.events.some((e) => e.confidence === "incertain" || e.status === "simulation") ? "3 2" : undefined}
              onClick={() => onSelect(p.date)}
            />
          </g>
        ) : null,
      )}
      {f.min && f.min.balance < 0 && (
        <text x={x(pts.findIndex((p) => p.date === f.min!.date))} y={y(f.min.balance) - 10} textAnchor="middle" className="fill-danger text-[11px] font-semibold">
          {fmt(f.min.balance)}
        </text>
      )}
      {pts.map((p, i) =>
        i % step === 0 ? (
          <text key={p.date} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : "middle"} className="fill-muted-foreground text-[11px]">
            {i === 0 ? "Auj." : formatDateFr(p.date).replace(/ \w+$/, (m) => m.slice(0, 4) + ".")}
          </text>
        ) : null,
      )}
      {/* zone cliquable par jour */}
      {pts.map((p, i) => (
        <rect key={`hit-${p.date}`} x={x(i) - (W / pts.length) / 2} y={0} width={W / pts.length} height={H} fill="transparent" onClick={() => p.events.length && onSelect(p.date)} />
      ))}
    </svg>
  );
}

export function TresorerieTab({ demo }: { demo: Demo }) {
  const { data, fmt, base } = demo;
  const [days, setDays] = useState<number>(30);
  const [custom, setCustom] = useState(45);
  const [scenario, setScenario] = useState<"standard" | "prudent">("standard");
  const [selected, setSelected] = useState<string | null>(null);
  const [sim, setSim] = useState({ delayId: "", delayDays: 15, expense: 0, expenseDate: addDays(TODAY, 10), drop: 0, newContract: 0, contractDate: addDays(TODAY, 20), fx: {} as Record<string, number> });
  const simActive = !!(sim.delayId || sim.expense || sim.drop || sim.newContract || Object.keys(sim.fx).length);

  const horizon = days === -1 ? custom : days;
  const foreign = [...new Set(data.invoices.filter((i) => i.currency !== base).map((i) => i.currency))];
  const clientInvoices = data.invoices.filter((i) => i.kind === "client");

  const f = useMemo(() => {
    const simulations: SimulationEvent[] = [];
    if (sim.expense > 0) simulations.push({ date: sim.expenseDate, label: "Dépense exceptionnelle (simulation)", amount: -sim.expense });
    if (sim.newContract > 0) simulations.push({ date: sim.contractDate, label: "Nouveau contrat (simulation)", amount: sim.newContract });
    return forecast(data, {
      today: TODAY,
      days: horizon,
      scenario,
      delays: sim.delayId ? { [sim.delayId]: sim.delayDays } : undefined,
      simulations,
      variation: sim.drop ? { recettes: -sim.drop / 100 } : undefined,
      fxOverrides: sim.fx,
    });
  }, [data, horizon, scenario, sim]);

  const point: ForecastPoint | undefined = f.points.find((p) => p.date === selected);
  const month = monthKey(TODAY);
  const cf = cashFlowStatement(data, startOfMonth(month), TODAY);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Card
          tour="chart"
          title="Mon solde, jour par jour"
          help="Solde du jour + encaissements prévus − paiements prévus, date par date. Les mouvements déjà passés sont dans le solde du jour et ne sont jamais recomptés."
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Segmented label="Période" value={days} onChange={setDays} options={[{ value: 7, label: "7 j" }, { value: 30, label: "30 j" }, { value: 90, label: "90 j" }, { value: -1, label: "Autre" }]} />
            {days === -1 && (
              <input type="number" min={1} max={365} value={custom} onChange={(e) => setCustom(Math.max(1, Math.min(365, Number(e.target.value) || 1)))} className={`${inputCls} w-24 py-1.5`} aria-label="Nombre de jours" />
            )}
            <Segmented label="Scénario" value={scenario} onChange={setScenario} options={[{ value: "standard", label: "Standard" }, { value: "prudent", label: "Prudent" }]} />
          </div>
          {scenario === "prudent" && (
            <p className="mb-3 text-xs text-muted-foreground">Scénario prudent : les paiements clients incertains ou déjà en retard sont décalés de 30 jours. Aucune probabilité n'est inventée.</p>
          )}
          {f.available ? (
            <Chart f={f} fmt={(v) => fmt(v)} selected={selected} onSelect={setSelected} />
          ) : (
            <p className="text-sm text-muted-foreground">{f.reason}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 border-primary" /> Prévu</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 border-dashed border-warning" /> Incertain, en retard ou simulé</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded bg-danger/30" /> Solde négatif</span>
            <span>Touchez un point pour le détail.</span>
          </div>
          {f.alert && (
            <p className="mt-3 flex gap-2 rounded-xl bg-danger/10 p-3 text-sm text-danger">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {f.alert}
            </p>
          )}
          {simActive && <p className="mt-3 rounded-xl bg-warning/15 p-3 text-sm">Simulation active : ces chiffres sont une hypothèse, pas une certitude.</p>}
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card title="Aujourd'hui"><p className="font-num text-2xl">{fmt(f.start)}</p></Card>
          <Card title="Point le plus bas" help="Le plus petit solde prévu sur la période. On part de votre argent disponible ce matin, puis, jour après jour, on ajoute ce que vos clients doivent payer et on retire ce que vous devez payer, à leurs dates. Il ne peut jamais dépasser votre argent d'aujourd'hui."><p className={`font-num text-2xl ${f.min && f.min.balance < 0 ? "text-danger" : ""}`}>{f.min ? fmt(f.min.balance) : "—"}</p><p className="text-xs text-muted-foreground">{f.min && formatDateFr(f.min.date)}</p></Card>
          <Card title={`Dans ${horizon} jours`}><p className="font-num text-2xl">{fmt(f.end)}</p></Card>
        </div>

        <Card title="Détail des mouvements prévus">
          {f.unconverted.length > 0 && <p className="mb-2 text-sm text-danger">Non convertis faute de taux : {f.unconverted.map((u) => u.label).join(", ")}</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="py-2 font-semibold">Date</th><th className="font-semibold">Mouvement</th><th className="text-right font-semibold">Montant</th><th className="text-right font-semibold">Solde prévu</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr><td className="py-2">Aujourd'hui</td><td className="text-muted-foreground">Solde actuel</td><td /><td className="font-num text-right">{fmt(f.start)}</td></tr>
                {f.points.filter((p) => p.events.length).flatMap((p) =>
                  p.events.map((e, i) => (
                    <tr key={e.sourceId} className={selected === p.date ? "bg-primary/5" : ""} onClick={() => setSelected(p.date)}>
                      <td className="py-2 whitespace-nowrap">{i === 0 ? formatDateFr(p.date) : ""}</td>
                      <td>
                        {e.label}{" "}
                        {e.status === "en_retard" && <Badge tone="danger">en retard</Badge>}{" "}
                        {e.confidence === "incertain" && <Badge tone="warning">incertain</Badge>}{" "}
                        {e.shifted && <Badge tone="warning">décalé</Badge>}{" "}
                        {e.status === "simulation" && <Badge tone="info">simulation</Badge>}
                        {e.estimatedFx && <span className="block text-xs text-muted-foreground">{fmt(e.original.amount, e.original.currency)} · contre-valeur estimée</span>}
                      </td>
                      <td className={`font-num text-right ${e.amount > 0 ? "text-success" : ""}`}>{e.amount > 0 ? "+" : "−"}{fmt(Math.abs(e.amount))}</td>
                      <td className={`font-num text-right ${p.balance < 0 ? "text-danger" : ""}`}>{i === p.events.length - 1 ? fmt(p.balance) : ""}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Si tout était payé et encaissé d'ici là, vous finiriez la période avec {fmt(f.end)}. Ce total final ne montre pas les creux entre-temps : c'est pour cela que le tableau suit les dates, jour après jour.
          </p>
        </Card>
      </div>

      <div className="space-y-4">
        {point && (
          <Card title={`Le ${formatDateFr(point.date)}`}>
            {point.events.map((e) => <Row key={e.sourceId} label={e.label} value={`${e.amount > 0 ? "+" : "−"}${fmt(Math.abs(e.amount))}`} />)}
            <Row label="Solde prévu le soir" value={fmt(point.balance)} strong tone={point.balance < 0 ? "danger" : undefined} />
          </Card>
        )}

        <Card tour="simulate" title={<><FlaskConical className="size-4" /> Simuler</>} help="Testez un imprévu sans rien modifier dans vos données.">
          <div className="space-y-3">
            <Field label="Un client paie en retard">
              <div className="flex gap-2">
                <select className={inputCls} value={sim.delayId} onChange={(e) => setSim({ ...sim, delayId: e.target.value })}>
                  <option value="">Aucun</option>
                  {clientInvoices.map((i) => <option key={i.id} value={i.id}>{i.party} — {i.description}</option>)}
                </select>
                <input type="number" min={1} className={`${inputCls} w-20`} value={sim.delayDays} onChange={(e) => setSim({ ...sim, delayDays: Number(e.target.value) || 0 })} aria-label="Jours de retard" />
              </div>
            </Field>
            <Field label="Dépense exceptionnelle">
              <div className="flex gap-2">
                <input type="number" min={0} className={inputCls} value={sim.expense || ""} placeholder={`Montant (${base})`} onChange={(e) => setSim({ ...sim, expense: Number(e.target.value) || 0 })} />
                <input type="date" className={`${inputCls} w-40`} value={sim.expenseDate} min={TODAY} onChange={(e) => setSim({ ...sim, expenseDate: e.target.value })} />
              </div>
            </Field>
            <Field label="Nouveau contrat encaissé">
              <div className="flex gap-2">
                <input type="number" min={0} className={inputCls} value={sim.newContract || ""} placeholder={`Montant (${base})`} onChange={(e) => setSim({ ...sim, newContract: Number(e.target.value) || 0 })} />
                <input type="date" className={`${inputCls} w-40`} value={sim.contractDate} min={TODAY} onChange={(e) => setSim({ ...sim, contractDate: e.target.value })} />
              </div>
            </Field>
            <Field label={`Baisse des encaissements prévus : ${sim.drop} %`}>
              <input type="range" min={0} max={80} step={5} value={sim.drop} onChange={(e) => setSim({ ...sim, drop: Number(e.target.value) })} className="w-full accent-[rgb(var(--primary))]" />
            </Field>
            {foreign.map((cur) => (
              <Field key={cur} label={`Taux ${cur} → ${base} (simulation)`} hint="Laissez vide pour le taux connu. Un taux futur n'est jamais certain.">
                <input
                  type="number"
                  step="0.0001"
                  min={0}
                  className={inputCls}
                  value={sim.fx[cur] ?? ""}
                  onChange={(e) => {
                    const fx = { ...sim.fx };
                    if (e.target.value) fx[cur] = Number(e.target.value);
                    else delete fx[cur];
                    setSim({ ...sim, fx });
                  }}
                />
              </Field>
            ))}
            {simActive && (
              <button className="text-sm font-semibold text-primary" onClick={() => setSim({ delayId: "", delayDays: 15, expense: 0, expenseDate: addDays(TODAY, 10), drop: 0, newContract: 0, contractDate: addDays(TODAY, 20), fx: {} })}>
                Effacer la simulation
              </button>
            )}
          </div>
        </Card>

        <Card title="Mouvements réels ce mois-ci" help="Uniquement l'argent qui a réellement bougé, depuis le 1er du mois. À ne pas confondre avec la rentabilité.">
          <Row label="Solde au début du mois" value={cf.openingBalance === null ? "—" : fmt(cf.openingBalance)} />
          <Row label="Encaissements réels" value={`+${fmt(cf.inflows)}`} tone="success" />
          <Row label="Décaissements réels" value={`−${fmt(cf.outflows)}`} />
          <Row label="Variation" value={fmt(cf.net)} strong />
          <Row label="Solde aujourd'hui" value={cf.closingBalance === null ? "—" : fmt(cf.closingBalance)} />
          {cf.conversionGap ? <Row label={<>Écart de conversion <Help>Effet des taux de change sur les comptes en devises étrangères.</Help></>} value={fmt(cf.conversionGap)} tone="muted" /> : null}
          <p className="mt-2 text-xs text-muted-foreground">
            Dont activité {fmt(cf.byKind.exploitation)} · investissements {fmt(cf.byKind.investissement)} · apports, retraits et emprunts {fmt(cf.byKind.financement)}
          </p>
        </Card>
      </div>
    </div>
  );
}
