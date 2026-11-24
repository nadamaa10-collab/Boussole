import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { commitments, economicQuote, formatDateFr, invoiceState, type Confidence, type Invoice } from "@/lib/finance";
import type { Demo } from "./store";
import { TODAY, newId } from "./store";
import { Badge, Card, Empty, Errors, Field, PrimaryButton, Row, Segmented, Sheet, inputCls, type BadgeTone } from "./ui";

export function statusTone(inv: Invoice, data: Demo["data"]): BadgeTone {
  const st = invoiceState(inv, data.payments, TODAY);
  if (st.settlement === "payee") return "success";
  if (st.settlement === "annulee") return "neutral";
  if (st.due === "en_retard") return "danger";
  if (st.settlement === "partielle" || st.due === "aujourdhui") return "warning";
  return "info";
}

export function FacturesTab({ demo }: { demo: Demo }) {
  const { data, fmt } = demo;
  const [kind, setKind] = useState<"client" | "fournisseur">("client");
  const [filter, setFilter] = useState<"ouvertes" | "toutes">("ouvertes");
  const [openId, setOpenId] = useState<string | null>(null);
  const c = commitments(data, TODAY);
  const totals = kind === "client" ? c.receivables : c.payables;
  const list = data.invoices
    .filter((i) => i.kind === kind)
    .map((i) => ({ inv: i, st: invoiceState(i, data.payments, TODAY, data.settings.locale) }))
    .filter(({ st }) => filter === "toutes" || st.remaining > 0)
    .sort((a, b) => (a.st.remaining > 0 ? 0 : 1) - (b.st.remaining > 0 ? 0 : 1) || a.inv.dueDate.localeCompare(b.inv.dueDate));
  const open = data.invoices.find((i) => i.id === openId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Type" value={kind} onChange={setKind} options={[{ value: "client", label: "Clients" }, { value: "fournisseur", label: "Fournisseurs" }]} />
        <Segmented label="Filtre" value={filter} onChange={setFilter} options={[{ value: "ouvertes", label: "À régler" }, { value: "toutes", label: "Toutes" }]} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title={kind === "client" ? "À recevoir" : "À payer"} help="Somme des restes dus uniquement : une facture payée en partie ne compte que pour ce qui manque.">
          <p className="font-num text-3xl">{totals.total === null ? "—" : fmt(totals.total)}</p>
        </Card>
        <Card title="Dont en retard"><p className={`font-num text-3xl ${totals.lateTotal ? "text-danger" : ""}`}>{totals.lateTotal === null ? "—" : fmt(totals.lateTotal)}</p></Card>
      </div>

      <Card>
        {list.length === 0 ? (
          <Empty>{kind === "client" ? "Aucune facture client à encaisser." : "Aucune facture fournisseur à payer."}</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {list.map(({ inv, st }) => (
              <li key={inv.id}>
                <button onClick={() => setOpenId(inv.id)} className="flex w-full items-center gap-3 py-3 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{inv.party}</span>
                    <span className="block truncate text-sm text-muted-foreground">{inv.reference ? `${inv.reference} · ` : ""}{inv.description}</span>
                    <span className="mt-1 inline-block"><Badge tone={statusTone(inv, data)}>{st.label}</Badge></span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="font-num block">{fmt(st.remaining > 0 ? st.remaining : st.total, inv.currency)}</span>
                    <span className="text-xs text-muted-foreground">{st.remaining > 0 && st.paid > 0 ? `sur ${fmt(st.total, inv.currency)}` : st.remaining > 0 ? "reste dû" : "total"}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Sheet open={!!open} onClose={() => setOpenId(null)} title={open ? open.party : ""}>
        {open && <InvoiceDetail key={open.id} demo={demo} inv={open} />}
      </Sheet>
    </div>
  );
}

function InvoiceDetail({ demo, inv }: { demo: Demo; inv: Invoice }) {
  const { data, fmt, base, actions } = demo;
  const st = invoiceState(inv, data.payments, TODAY, data.settings.locale);
  const quote = economicQuote(data, inv);
  const accounts = data.accounts;
  const [accountId, setAccountId] = useState(accounts.find((a) => a.currency === inv.currency)?.id ?? accounts[0]!.id);
  const account = accounts.find((a) => a.id === accountId)!;
  const [amount, setAmount] = useState(st.remaining);
  const [settled, setSettled] = useState(st.remaining);
  const [date, setDate] = useState(TODAY);
  const [over, setOver] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [due, setDue] = useState(inv.dueDate);
  const [expected, setExpected] = useState(inv.expectedPaymentDate ?? "");
  const [confidence, setConfidence] = useState<Confidence>(inv.confidence ?? "probable");
  const sameCurrency = account.currency === inv.currency;

  const pay = () => {
    const errs = actions.addPayment(
      { id: newId("p"), invoiceId: inv.id, accountId, date, amount, settledAmount: sameCurrency ? undefined : settled },
      over,
    );
    setErrors(errs);
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">{inv.reference ? `${inv.reference} · ` : ""}{inv.description}</p>
        <div className="mt-2"><Badge tone={statusTone(inv, data)}>{st.label}</Badge></div>
      </div>
      <div className="rounded-2xl bg-card p-4">
        <Row label={inv.kind === "client" ? "Total facturé" : "Total dû"} value={fmt(st.total, inv.currency)} />
        <Row label={inv.kind === "client" ? "Déjà encaissé" : "Déjà réglé"} value={fmt(st.paid, inv.currency)} />
        <Row label="Reste" value={fmt(st.remaining, inv.currency)} strong />
        {st.overpaid > 0 && <Row label="Trop-perçu" value={fmt(st.overpaid, inv.currency)} tone="danger" />}
        <Row label="Date de facture" value={formatDateFr(inv.issueDate)} />
        <Row label="Échéance" value={formatDateFr(inv.dueDate)} />
        {inv.servicePeriod && <Row label="Prestation" value={`${formatDateFr(inv.servicePeriod.start)} → ${formatDateFr(inv.servicePeriod.end)}`} hint="Le revenu est réparti sur cette période" />}
        {inv.nature === "immobilisation" && <Row label="Amortissement" value={`${inv.usefulLifeMonths} mois`} hint="Payé en une fois, compté en charge sur sa durée d'utilisation" />}
        {inv.currency !== base && quote && (
          <Row label={`Valeur au taux de facture`} value={fmt(inv.amountHT * quote.rate)} hint={`1 ${inv.currency} = ${quote.rate.toFixed(4)} ${base} · ${quote.source}`} />
        )}
      </div>

      {st.payments.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-semibold">Historique des paiements</p>
          <ul className="divide-y divide-border rounded-2xl bg-card px-4">
            {st.payments.map((p) => {
              const acc = accounts.find((a) => a.id === p.accountId);
              return (
                <li key={p.id} className="flex justify-between py-2 text-sm">
                  <span>{formatDateFr(p.date)} · {acc?.name}</span>
                  <span className="font-num text-right">
                    {fmt(p.amount, acc?.currency ?? inv.currency)}
                    {p.settledAmount !== undefined && acc?.currency !== inv.currency && <span className="block text-xs text-muted-foreground">pour {fmt(p.settledAmount, inv.currency)}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {st.remaining > 0 && (
        <div className="space-y-3 rounded-2xl border border-border p-4">
          <p className="font-semibold">{inv.kind === "client" ? "Enregistrer un paiement reçu" : "Enregistrer un paiement effectué"}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Montant (${account.currency})`}>
              <input type="number" step="0.01" className={inputCls} value={amount || ""} onChange={(e) => { setAmount(Number(e.target.value)); if (sameCurrency) setSettled(Number(e.target.value)); }} />
            </Field>
            <Field label="Date">
              <input type="date" max={TODAY} className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <Field label="Compte">
            <select className={inputCls} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
            </select>
          </Field>
          {!sameCurrency && (
            <Field label={`Montant soldé sur la facture (${inv.currency})`} hint="Ce que le paiement règle réellement sur la facture. L'écart avec la valeur d'origine devient un écart de change.">
              <input type="number" step="0.01" className={inputCls} value={settled || ""} onChange={(e) => setSettled(Number(e.target.value))} />
            </Field>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-full bg-muted px-3 py-1 text-sm" onClick={() => { setAmount(st.remaining); setSettled(st.remaining); }}>Tout le reste</button>
            <button type="button" className="rounded-full bg-muted px-3 py-1 text-sm" onClick={() => { const h = Math.round(st.remaining * 50) / 100; setAmount(h); setSettled(h); }}>La moitié</button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={over} onChange={(e) => setOver(e.target.checked)} /> Accepter un trop-perçu
          </label>
          <Errors list={errors} />
          <PrimaryButton onClick={pay}>Enregistrer le paiement</PrimaryButton>
        </div>
      )}

      {st.remaining > 0 && (
        <div className="space-y-3 rounded-2xl border border-border p-4">
          <p className="font-semibold">Dates et fiabilité</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Échéance">
              <input type="date" className={inputCls} value={due} min={inv.issueDate} onChange={(e) => setDue(e.target.value)} />
            </Field>
            <Field label="Paiement estimé" hint="Si différent de l'échéance">
              <input type="date" className={inputCls} value={expected} onChange={(e) => setExpected(e.target.value)} />
            </Field>
          </div>
          {inv.kind === "client" && (
            <Field label="Ce paiement est…">
              <Segmented label="Fiabilité" value={confidence} onChange={setConfidence} options={[{ value: "confirme", label: "Confirmé" }, { value: "probable", label: "Probable" }, { value: "incertain", label: "Incertain" }]} />
            </Field>
          )}
          <PrimaryButton onClick={() => actions.updateInvoice(inv.id, { dueDate: due, expectedPaymentDate: expected || undefined, confidence })}>Mettre à jour la prévision</PrimaryButton>
        </div>
      )}
    </div>
  );
}
