import { useEffect, useState } from "react";
import { ChevronRight, Pencil, Trash2 } from "lucide-react";
import { InvoiceForm } from "./AddSheet";
import { commitments, economicQuote, formatDateFr, invoiceState, type Confidence, type Invoice, type Payment } from "@/lib/finance";
import type { Demo } from "./store";
import { TODAY, newId } from "./store";
import { CONFIDENCE_HELP, Badge, Card, Empty, Errors, Field, PrimaryButton, Row, Segmented, Sheet, inputCls, type BadgeTone } from "./ui";

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
  const [filter, setFilter] = useState<"ouvertes" | "payees" | "toutes">("toutes");
  const [cat, setCat] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const c = commitments(data, TODAY);
  const totals = kind === "client" ? c.receivables : c.payables;
  const list = data.invoices
    .filter((i) => i.kind === kind)
    .map((i) => ({ inv: i, st: invoiceState(i, data.payments, TODAY, data.settings.locale) }))
    .filter(({ st }) => filter === "toutes" || (filter === "ouvertes" ? st.remaining > 0 : st.remaining <= 0))
    .filter(({ inv }) => !cat || inv.category === cat)
    .sort((a, b) => (a.st.remaining > 0 ? 0 : 1) - (b.st.remaining > 0 ? 0 : 1) || a.inv.dueDate.localeCompare(b.inv.dueDate));
  const open = data.invoices.find((i) => i.id === openId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Type" value={kind} onChange={setKind} options={[{ value: "client", label: "Recettes (clients)" }, { value: "fournisseur", label: "Dépenses" }]} />
        <div className="flex flex-wrap items-center gap-2">
          <select className={`${inputCls} w-auto py-1.5 text-sm`} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Catégorie">
            <option value="">Toutes les catégories</option>
            {[...new Set(data.invoices.filter((i) => i.kind === kind).map((i) => i.category))].sort().map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Segmented label="Filtre" value={filter} onChange={setFilter} options={[{ value: "toutes", label: "Toutes" }, { value: "ouvertes", label: "À régler" }, { value: "payees", label: "Payées" }]} />
        </div>
      </div>
      {cat && (
        <p className="text-sm text-muted-foreground">
          {list.length} {kind === "client" ? "facture(s)" : "dépense(s)"} en « {cat} » · total {fmt(list.filter((x) => x.inv.currency === demo.base).reduce((s, x) => s + x.st.total, 0))}{list.some((x) => x.inv.currency !== demo.base) ? " hors factures en devise étrangère" : ""}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title={kind === "client" ? "À recevoir" : "À payer"} help="Somme des restes dus uniquement : une facture payée en partie ne compte que pour ce qui manque.">
          <p className="font-num text-3xl">{totals.total === null ? "—" : fmt(totals.total)}</p>
        </Card>
        <Card title="Dont en retard"><p className={`font-num text-3xl ${totals.lateTotal ? "text-danger" : ""}`}>{totals.lateTotal === null ? "—" : fmt(totals.lateTotal)}</p></Card>
      </div>

      <Card tour="invoices">
        {list.length === 0 ? (
          <Empty>{filter === "toutes" ? (kind === "client" ? "Aucune facture client pour l'instant. Ajoutez-en une avec « + Ajouter »." : "Aucune dépense pour l'instant. Ajoutez-en une avec « + Ajouter ».") : "Rien dans ce filtre."}</Empty>
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
        {open && <InvoiceDetail key={open.id} demo={demo} inv={open} onClose={() => setOpenId(null)} />}
      </Sheet>
    </div>
  );
}

export function InvoiceDetail({ demo, inv, onClose }: { demo: Demo; inv: Invoice; onClose: () => void }) {
  const { data, fmt, base, actions } = demo;
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmPay, setConfirmPay] = useState<string | null>(null);
  const [editPay, setEditPay] = useState<string | null>(null);
  const [unpay, setUnpay] = useState(false);
  const [unpayDue, setUnpayDue] = useState(inv.dueDate);
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
  // Le montant proposé suit le reste dû (après une modification ou un paiement).
  useEffect(() => {
    setAmount(st.remaining);
    setSettled(st.remaining);
  }, [st.remaining]);

  const pay = () => {
    const errs = actions.addPayment(
      { id: newId("p"), invoiceId: inv.id, accountId, date, amount, settledAmount: sameCurrency ? undefined : settled },
      over,
    );
    setErrors(errs);
  };

  if (editing) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Modifiez ce qui est nécessaire. Les paiements déjà enregistrés sont conservés.</p>
        <InvoiceForm demo={demo} kind={inv.kind} initial={inv} done={() => setEditing(false)} />
        <button className="w-full py-2 text-sm text-muted-foreground" onClick={() => setEditing(false)}>Annuler</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{inv.reference ? `${inv.reference} · ` : ""}{inv.description} · {inv.category}</p>
          <div className="mt-2"><Badge tone={statusTone(inv, data)}>{st.label}</Badge></div>
          <p className="mt-2 text-xs text-muted-foreground">
            Le statut se met à jour tout seul : « payée » dès qu'un paiement couvre le montant, « en retard » si l'échéance est dépassée sans paiement complet.
          </p>
        </div>
        <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
          <Pencil className="size-4" /> Modifier
        </button>
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
        <div className="rounded-2xl border border-border p-4">
          {!unpay ? (
            <button onClick={() => setUnpay(true)} className="text-sm font-semibold text-primary">
              {inv.kind === "client" ? "Ce client n'a pas (encore) payé ? Marquer comme non payée" : "Pas encore réglée ? Marquer comme non payée"}
            </button>
          ) : (
            <div className="space-y-3 text-sm">
              <p>Les paiements enregistrés seront retirés et votre argent disponible recalculé. Si l'échéance est déjà passée, la {inv.kind === "client" ? "facture" : "dépense"} apparaîtra « en retard ».</p>
              <Field label="Échéance">
                <input type="date" className={inputCls} value={unpayDue} onChange={(e) => setUnpayDue(e.target.value)} />
              </Field>
              <p className="text-xs text-muted-foreground">{unpayDue < TODAY ? "Échéance passée : elle sera affichée en retard." : unpayDue === TODAY ? "Échéance aujourd'hui." : "Échéance à venir : elle sera affichée « à payer »."}</p>
              <div className="flex gap-2">
                <button onClick={() => { actions.markUnpaid(inv.id, unpayDue); setUnpay(false); }} className="rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground">Confirmer</button>
                <button onClick={() => setUnpay(false)} className="rounded-full px-4 py-2 font-semibold">Annuler</button>
              </div>
            </div>
          )}
        </div>
      )}

      {st.payments.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-semibold">Historique des paiements</p>
          <ul className="divide-y divide-border rounded-2xl bg-card px-4">
            {st.payments.map((p) => {
              const acc = accounts.find((a) => a.id === p.accountId);
              if (editPay === p.id) return <PaymentEditor key={p.id} demo={demo} inv={inv} payment={p} done={() => setEditPay(null)} />;
              return (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span>{formatDateFr(p.date)} · {acc?.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-num text-right">
                      {fmt(p.amount, acc?.currency ?? inv.currency)}
                      {p.settledAmount !== undefined && acc?.currency !== inv.currency && <span className="block text-xs text-muted-foreground">pour {fmt(p.settledAmount, inv.currency)}</span>}
                    </span>
                    <button onClick={() => setEditPay(p.id)} aria-label="Modifier ce paiement" title="Modifier le compte, la date ou le montant" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
                      <Pencil className="size-4" />
                    </button>
                    {confirmPay === p.id ? (
                      <button onClick={() => { actions.deletePayment(p.id); setConfirmPay(null); }} className="rounded-full bg-danger px-2.5 py-1 text-xs font-semibold text-white">Confirmer</button>
                    ) : (
                      <button onClick={() => setConfirmPay(p.id)} aria-label="Supprimer ce paiement" title="Supprimer ce paiement (vous pourrez le ressaisir)" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
                        <Trash2 className="size-4" />
                      </button>
                    )}
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
            <Field label="Fiabilité du paiement" hint={CONFIDENCE_HELP[confidence]}>
              <Segmented label="Fiabilité" value={confidence} onChange={setConfidence} options={[{ value: "confirme", label: "Confirmé" }, { value: "probable", label: "Probable" }, { value: "incertain", label: "Incertain" }]} />
            </Field>
          )}
          <PrimaryButton onClick={() => actions.updateInvoice(inv.id, { dueDate: due, expectedPaymentDate: expected || undefined, confidence })}>Mettre à jour la prévision</PrimaryButton>
        </div>
      )}

      <div className="border-t border-border pt-4">
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-danger">
            <Trash2 className="size-4" /> Supprimer {inv.kind === "client" ? "cette facture" : "cette dépense"}
          </button>
        ) : (
          <div className="space-y-2 rounded-2xl bg-danger/10 p-3 text-sm">
            <p>{st.payments.length ? `Ses ${st.payments.length} paiement(s) seront aussi supprimés et votre solde sera recalculé.` : "Elle disparaîtra de vos prévisions et de votre rentabilité."} Continuer ?</p>
            <div className="flex gap-2">
              <button onClick={() => { actions.deleteInvoice(inv.id); onClose(); }} className="rounded-full bg-danger px-4 py-2 font-semibold text-white">Oui, supprimer</button>
              <button onClick={() => setConfirmDelete(false)} className="rounded-full px-4 py-2 font-semibold">Annuler</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Modifier un paiement déjà enregistré : compte (ex. banque → caisse), date ou montant. */
function PaymentEditor({ demo, inv, payment, done }: { demo: Demo; inv: Invoice; payment: Payment; done: () => void }) {
  const { data, actions } = demo;
  const [accountId, setAccountId] = useState(payment.accountId);
  const [date, setDate] = useState(payment.date);
  const [amount, setAmount] = useState(payment.amount);
  const [settled, setSettled] = useState(payment.settledAmount ?? payment.amount);
  const [errors, setErrors] = useState<string[]>([]);
  const account = data.accounts.find((a) => a.id === accountId)!;
  const same = account.currency === inv.currency;
  const save = () => {
    const errs = actions.addPayment({ ...payment, accountId, date, amount, settledAmount: same ? undefined : settled });
    setErrors(errs);
    if (!errs.length) done();
  };
  return (
    <li className="space-y-2 py-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Compte">
          <select className={inputCls} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" max={TODAY} className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={`Montant (${account.currency})`}>
          <input type="number" step="0.01" className={inputCls} value={amount || ""} onChange={(e) => { setAmount(Number(e.target.value)); if (same) setSettled(Number(e.target.value)); }} />
        </Field>
        {!same && (
          <Field label={`Soldé sur la facture (${inv.currency})`}>
            <input type="number" step="0.01" className={inputCls} value={settled || ""} onChange={(e) => setSettled(Number(e.target.value))} />
          </Field>
        )}
      </div>
      <Errors list={errors} />
      <div className="flex gap-2">
        <button onClick={save} className="rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground">Enregistrer</button>
        <button onClick={done} className="rounded-full px-4 py-2 font-semibold">Annuler</button>
      </div>
    </li>
  );
}
