import { useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, FilePlus2, Receipt } from "lucide-react";
import { CURRENCIES, addDays, findRate, invoiceState, type Invoice } from "@/lib/finance";
import type { Demo } from "./store";
import { TODAY, newId } from "./store";
import { Errors, Field, PrimaryButton, Sheet, inputCls } from "./ui";

type Mode = "menu" | "recette" | "depense" | "recu" | "effectue" | "transfert";

const OPTIONS = [
  { mode: "recette" as const, icon: FilePlus2, title: "Recette / facture client", text: "Une prestation vendue" },
  { mode: "depense" as const, icon: Receipt, title: "Dépense / facture fournisseur", text: "Un achat, une facture reçue" },
  { mode: "recu" as const, icon: ArrowDownLeft, title: "Paiement reçu", text: "Un client vous a payé" },
  { mode: "effectue" as const, icon: ArrowUpRight, title: "Paiement effectué", text: "Vous avez réglé un fournisseur" },
  { mode: "transfert" as const, icon: ArrowLeftRight, title: "Transfert entre comptes", text: "Ni revenu, ni dépense" },
];

const TITLES: Record<Mode, string> = {
  menu: "Ajouter",
  recette: "Nouvelle recette",
  depense: "Nouvelle dépense",
  recu: "Paiement reçu",
  effectue: "Paiement effectué",
  transfert: "Transfert entre comptes",
};

export function AddSheet({ demo, open, onClose }: { demo: Demo; open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("menu");
  const close = () => {
    setMode("menu");
    onClose();
  };
  return (
    <Sheet open={open} onClose={close} title={TITLES[mode]}>
      {mode === "menu" && (
        <ul className="grid gap-2">
          {OPTIONS.map((o) => (
            <li key={o.mode}>
              <button onClick={() => setMode(o.mode)} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left hover:border-primary">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><o.icon className="size-5" /></span>
                <span>
                  <span className="block font-semibold">{o.title}</span>
                  <span className="text-sm text-muted-foreground">{o.text}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {(mode === "recette" || mode === "depense") && <InvoiceForm demo={demo} kind={mode === "recette" ? "client" : "fournisseur"} done={close} />}
      {(mode === "recu" || mode === "effectue") && <PaymentForm demo={demo} kind={mode === "recu" ? "client" : "fournisseur"} done={close} />}
      {mode === "transfert" && <TransferForm demo={demo} done={close} />}
      {mode !== "menu" && <button className="mt-3 w-full py-2 text-sm text-muted-foreground" onClick={() => setMode("menu")}>← Autre type d'opération</button>}
    </Sheet>
  );
}

/** Formulaire de facture : création, ou modification si `initial` est fourni. */
export function InvoiceForm({ demo, kind, done, initial }: { demo: Demo; kind: "client" | "fournisseur"; done: () => void; initial?: Invoice }) {
  const { data, base, actions } = demo;
  const client = kind === "client";
  const editing = !!initial;
  const hasPayments = editing && data.payments.some((p) => p.invoiceId === initial.id);
  const [f, setF] = useState({
    party: initial?.party ?? "",
    description: initial?.description ?? "",
    amount: initial?.amountHT ?? 0,
    currency: initial?.currency ?? base,
    issueDate: initial?.issueDate ?? TODAY,
    dueDate: initial?.dueDate ?? addDays(TODAY, client ? 30 : 15),
    paid: false,
    accountId: data.accounts[0]!.id,
    category: initial?.category ?? (client ? "Prestations" : "Divers"),
    vat: initial?.vatAmount ?? 0,
    expected: initial?.expectedPaymentDate ?? "",
    confidence: (initial?.confidence ?? "probable") as Invoice["confidence"],
    immo: initial?.nature === "immobilisation",
    months: initial?.usefulLifeMonths ?? 36,
    spread: !!initial?.servicePeriod,
    periodEnd: initial?.servicePeriod?.end ?? addDays(TODAY, 89),
    rate: initial?.economicRate?.rate ?? 0,
  });
  const [advanced, setAdvanced] = useState(editing);
  const [errors, setErrors] = useState<string[]>([]);
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const categories = [...new Set(data.invoices.filter((i) => i.kind === kind).map((i) => i.category).concat(data.budgets.map((b) => b.category)))];
  const account = data.accounts.find((a) => a.id === f.accountId)!;
  const knownRate = f.currency === base ? null : findRate(data.rates, f.currency, base, f.issueDate);
  const needsRate = f.currency !== base && !knownRate;

  const submit = () => {
    if (needsRate && !(f.rate > 0)) {
      setErrors([`Indiquez le taux ${f.currency} → ${base} à la date de la facture.`]);
      return;
    }
    const inv: Invoice = {
      ...initial,
      id: initial?.id ?? newId(client ? "f" : "a"),
      kind,
      party: f.party.trim(),
      description: f.description.trim() || (client ? "Prestation" : "Achat"),
      category: f.category,
      nature: !client && f.immo ? "immobilisation" : "exploitation",
      usefulLifeMonths: !client && f.immo ? f.months : undefined,
      currency: f.currency,
      amountHT: f.amount,
      vatAmount: f.vat,
      issueDate: f.issueDate,
      dueDate: f.dueDate,
      expectedPaymentDate: f.expected || undefined,
      confidence: client ? f.confidence : undefined,
      servicePeriod: client && f.spread ? { start: f.issueDate, end: f.periodEnd } : undefined,
      economicRate: needsRate
        ? { rate: f.rate, date: f.issueDate, source: "Saisie manuelle", base }
        : initial && initial.currency === f.currency && initial.issueDate === f.issueDate
          ? initial.economicRate
          : undefined,
    };
    if (editing) {
      const rates = needsRate ? [{ from: f.currency, to: base, rate: f.rate, date: f.issueDate, source: "Saisie manuelle" }] : [];
      const errs = actions.saveInvoice(inv, rates);
      setErrors(errs);
      if (!errs.length) done();
      return;
    }
    if (f.paid && account.currency !== f.currency) {
      setErrors(["Pour un paiement immédiat, choisissez un compte dans la devise de la facture, ou enregistrez le paiement ensuite depuis la facture."]);
      return;
    }
    const rates = needsRate ? [{ from: f.currency, to: base, rate: f.rate, date: f.issueDate, source: "Saisie manuelle" }] : [];
    const errs = actions.addInvoice(inv, f.paid ? { accountId: f.accountId, amount: f.amount + f.vat } : undefined, rates);
    setErrors(errs);
    if (!errs.length) done();
  };

  return (
    <div className="space-y-3">
      <Field label={client ? "Client" : "Fournisseur"}>
        <input autoFocus className={inputCls} value={f.party} onChange={(e) => set({ party: e.target.value })} placeholder={client ? "Ex. Studio Nord" : "Ex. Imprimerie Duval"} />
      </Field>
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <Field label={`Montant ${data.settings.vatRegistered ? "HT" : ""}`}>
          <input type="number" inputMode="decimal" min={0} step="0.01" className={inputCls} value={f.amount || ""} onChange={(e) => set({ amount: Number(e.target.value) })} />
        </Field>
        <Field label="Devise">
          <select className={inputCls} value={f.currency} disabled={hasPayments} title={hasPayments ? "Des paiements existent déjà dans cette devise" : undefined} onChange={(e) => set({ currency: e.target.value })}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Description">
        <input className={inputCls} value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder={client ? "Ex. Site vitrine" : "Ex. Impressions"} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" className={inputCls} value={f.issueDate} onChange={(e) => set({ issueDate: e.target.value })} /></Field>
        <Field label="Échéance"><input type="date" className={inputCls} value={f.dueDate} onChange={(e) => set({ dueDate: e.target.value })} /></Field>
      </div>
      {!editing && (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.paid} onChange={(e) => set({ paid: e.target.checked })} /> {client ? "Déjà encaissée" : "Déjà payée"}
        {f.paid && (
          <select className="ml-auto rounded-lg border border-border bg-card px-2 py-1" value={f.accountId} onChange={(e) => set({ accountId: e.target.value })}>
            {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
          </select>
        )}
      </label>
      )}
      {needsRate && (
        <Field label={`1 ${f.currency} = combien de ${base} ?`} hint="Taux du jour de la facture. Il sera figé pour calculer votre rentabilité.">
          <input type="number" step="0.0001" min={0} className={inputCls} value={f.rate || ""} onChange={(e) => set({ rate: Number(e.target.value) })} />
        </Field>
      )}
      {knownRate && <p className="text-xs text-muted-foreground">Valeur en {base} calculée avec le taux connu : 1 {f.currency} = {knownRate.rate.toFixed(4)} {base} ({knownRate.source}).</p>}

      <button type="button" className="text-sm font-semibold text-primary" onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced}>
        {advanced ? "Masquer les options" : "Plus d'options (catégorie, TVA, date estimée…)"}
      </button>
      {advanced && (
        <div className="space-y-3 rounded-2xl bg-muted/50 p-3">
          <Field label="Catégorie">
            <input className={inputCls} list={`cats-${kind}`} value={f.category} onChange={(e) => set({ category: e.target.value })} />
            <datalist id={`cats-${kind}`}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="TVA (montant)"><input type="number" min={0} className={inputCls} value={f.vat || ""} onChange={(e) => set({ vat: Number(e.target.value) })} /></Field>
          <Field label="Date de paiement estimée" hint="Si vous pensez être payé (ou payer) à une autre date que l'échéance.">
            <input type="date" className={inputCls} value={f.expected} onChange={(e) => set({ expected: e.target.value })} />
          </Field>
          {client && (
            <Field label="Ce paiement est…">
              <select className={inputCls} value={f.confidence} onChange={(e) => set({ confidence: e.target.value as Invoice["confidence"] })}>
                <option value="confirme">Confirmé</option>
                <option value="probable">Probable</option>
                <option value="incertain">Incertain</option>
              </select>
            </Field>
          )}
          {client && (
            <label className="block text-sm">
              <span className="flex items-center gap-2"><input type="checkbox" checked={f.spread} onChange={(e) => set({ spread: e.target.checked })} /> Prestation étalée sur plusieurs mois</span>
              {f.spread && <input type="date" className={`${inputCls} mt-2`} value={f.periodEnd} onChange={(e) => set({ periodEnd: e.target.value })} aria-label="Fin de la prestation" />}
            </label>
          )}
          {!client && (
            <label className="block text-sm">
              <span className="flex items-center gap-2"><input type="checkbox" checked={f.immo} onChange={(e) => set({ immo: e.target.checked })} /> Équipement durable (ordinateur, véhicule…)</span>
              {f.immo && (
                <span className="mt-2 flex items-center gap-2">
                  Utilisé pendant <input type="number" min={1} className="w-20 rounded-lg border border-border bg-card px-2 py-1" value={f.months} onChange={(e) => set({ months: Number(e.target.value) })} /> mois
                </span>
              )}
            </label>
          )}
        </div>
      )}
      <Errors list={errors} />
      <PrimaryButton onClick={submit} disabled={!f.party.trim() || !(f.amount > 0)}>{editing ? "Enregistrer les modifications" : "Ajouter"}</PrimaryButton>
    </div>
  );
}

function PaymentForm({ demo, kind, done }: { demo: Demo; kind: "client" | "fournisseur"; done: () => void }) {
  const { data, fmt, actions } = demo;
  const open = data.invoices
    .filter((i) => i.kind === kind)
    .map((i) => ({ i, st: invoiceState(i, data.payments, TODAY) }))
    .filter(({ st }) => st.remaining > 0);
  const [id, setId] = useState(open[0]?.i.id ?? "");
  const sel = open.find((o) => o.i.id === id);
  const [amount, setAmount] = useState(sel?.st.remaining ?? 0);
  const [settled, setSettled] = useState(sel?.st.remaining ?? 0);
  const [accountId, setAccountId] = useState(data.accounts.find((a) => a.currency === sel?.i.currency)?.id ?? data.accounts[0]!.id);
  const [date, setDate] = useState(TODAY);
  const [errors, setErrors] = useState<string[]>([]);
  const account = data.accounts.find((a) => a.id === accountId)!;

  if (!open.length) return <p className="text-sm text-muted-foreground">Aucune facture {kind === "client" ? "client" : "fournisseur"} en attente de paiement.</p>;

  const choose = (newId: string) => {
    const o = open.find((x) => x.i.id === newId)!;
    setId(newId);
    setAmount(o.st.remaining);
    setSettled(o.st.remaining);
    setAccountId(data.accounts.find((a) => a.currency === o.i.currency)?.id ?? data.accounts[0]!.id);
  };

  const submit = () => {
    const same = account.currency === sel!.i.currency;
    const errs = actions.addPayment({ id: newId("p"), invoiceId: id, accountId, date, amount, settledAmount: same ? undefined : settled });
    setErrors(errs);
    if (!errs.length) done();
  };

  return (
    <div className="space-y-3">
      <Field label="Facture">
        <select className={inputCls} value={id} onChange={(e) => choose(e.target.value)}>
          {open.map(({ i, st }) => <option key={i.id} value={i.id}>{i.party} — {i.description} · reste {fmt(st.remaining, i.currency)}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Montant (${account.currency})`} hint={sel && amount < sel.st.remaining && account.currency === sel.i.currency ? "Paiement partiel" : undefined}>
          <input type="number" inputMode="decimal" step="0.01" className={inputCls} value={amount || ""} onChange={(e) => { setAmount(Number(e.target.value)); if (account.currency === sel?.i.currency) setSettled(Number(e.target.value)); }} />
        </Field>
        <Field label="Date"><input type="date" max={TODAY} className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <Field label="Compte">
        <select className={inputCls} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
        </select>
      </Field>
      {sel && account.currency !== sel.i.currency && (
        <Field label={`Montant soldé sur la facture (${sel.i.currency})`}>
          <input type="number" step="0.01" className={inputCls} value={settled || ""} onChange={(e) => setSettled(Number(e.target.value))} />
        </Field>
      )}
      <Errors list={errors} />
      <PrimaryButton onClick={submit}>Enregistrer</PrimaryButton>
    </div>
  );
}

function TransferForm({ demo, done }: { demo: Demo; done: () => void }) {
  const { data, actions } = demo;
  const [from, setFrom] = useState(data.accounts[0]!.id);
  const [to, setTo] = useState(data.accounts[1]?.id ?? "");
  const [amount, setAmount] = useState(0);
  const [toAmount, setToAmount] = useState(0);
  const [date, setDate] = useState(TODAY);
  const [errors, setErrors] = useState<string[]>([]);
  const a = data.accounts.find((x) => x.id === from)!;
  const b = data.accounts.find((x) => x.id === to);
  const diff = b && a.currency !== b.currency;

  const submit = () => {
    const errs = actions.addMovement({ id: newId("m"), type: "transfert", date, accountId: from, amount, toAccountId: to, toAmount: diff ? toAmount : amount, description: `Transfert ${a.name} → ${b?.name ?? ""}` });
    setErrors(errs);
    if (!errs.length) done();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Depuis"><select className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)}>{data.accounts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        <Field label="Vers"><select className={inputCls} value={to} onChange={(e) => setTo(e.target.value)}>{data.accounts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      </div>
      <Field label={`Montant débité (${a.currency})`}><input type="number" step="0.01" className={inputCls} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} /></Field>
      {diff && <Field label={`Montant réellement reçu (${b!.currency})`} hint="Frais et taux de change inclus, tel qu'affiché par votre banque."><input type="number" step="0.01" className={inputCls} value={toAmount || ""} onChange={(e) => setToAmount(Number(e.target.value))} /></Field>}
      <Field label="Date"><input type="date" max={TODAY} className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <p className="text-xs text-muted-foreground">Un transfert ne change ni votre chiffre d'affaires, ni vos charges.</p>
      <Errors list={errors} />
      <PrimaryButton onClick={submit}>Enregistrer</PrimaryButton>
    </div>
  );
}
