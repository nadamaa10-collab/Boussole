import { useEffect, useRef, useState } from "react";
import { Tour, useTourSeen, type TourStep } from "./Tour";
import { Plus, Trash2, MousePointerClick } from "lucide-react";
import { CURRENCIES, currencyInfo, type SetupInput } from "@/lib/finance";
import { Errors, Field, PrimaryButton, inputCls } from "./ui";
import { TODAY } from "./store";

export function CurrencySelect({ value, onChange, id, label }: { value: string; onChange: (c: string) => void; id?: string; label?: string }) {
  return (
    <select id={id} aria-label={label} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      {CURRENCIES.map((c) => (
        <option key={c.code} value={c.code}>{c.code} · {c.name}</option>
      ))}
    </select>
  );
}

type AccountDraft = SetupInput["accounts"][number];

/** Configuration initiale : le minimum pour commencer, sans connaître son régime fiscal. */
export function SetupScreen({ onStart, onExample }: { onStart: (input: SetupInput) => void; onExample: () => void }) {
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [base, setBase] = useState("");
  const [vat, setVat] = useState(false);
  const [accounts, setAccounts] = useState<AccountDraft[]>([{ name: "Compte professionnel", kind: "banque", currency: "", balance: 0 }]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [seen, setSeen] = useTourSeen("setup");
  const [tour, setTour] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Le guide démarre tout seul la première fois que l'écran devient visible.
  useEffect(() => {
    if (seen || !ref.current) return;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting && e.intersectionRatio > 0.4) {
        setTour(true);
        io.disconnect();
      }
    }, { threshold: [0.4] });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen]);

  const steps: TourStep[] = [
    { target: ["[data-tour=setup-name]"], title: "Le nom de votre activité", text: "Votre nom commercial ou votre nom tout court. Il s'affichera en haut de votre tableau de bord." },
    { target: ["[data-tour=setup-currency]"], title: "Votre devise principale", text: "Celle dans laquelle vous voulez voir vos totaux. Vous pourrez quand même facturer ou payer dans d'autres devises." },
    { target: ["[data-tour=setup-vat]"], title: "La TVA", text: "Cochez seulement si vous facturez la TVA à vos clients. Dans le doute, laissez décoché : vous pourrez le changer plus tard." },
    { target: ["[data-tour=setup-account]"], title: "Vos comptes et leur solde", text: "Donnez un nom au compte, puis tapez le solde que votre banque affiche aujourd'hui. Boussole part de ce montant." },
    { target: ["[data-tour=setup-add-account]"], title: "D'autres comptes ?", text: "Compte épargne, caisse en espèces, compte en dollars… Ajoutez-les ici. Pour une autre devise, on vous demandera le taux du jour." },
    { target: ["[data-tour=setup-start]"], title: "C'est tout pour commencer", text: "Cliquez sur « Commencer ». Un second guide vous montrera ensuite où saisir vos factures, vos dépenses et vos charges." },
  ];

  const foreign = [...new Set(accounts.map((a) => a.currency || base).filter((c) => c && c !== base))];
  const setAcc = (i: number, p: Partial<AccountDraft>) => setAccounts(accounts.map((a, j) => (j === i ? { ...a, ...p } : a)));

  const submit = () => {
    const errs: string[] = [];
    if (!base) errs.push("Choisissez votre devise principale.");
    if (!accounts.length) errs.push("Ajoutez au moins un compte.");
    accounts.forEach((a, i) => !Number.isFinite(a.balance) && errs.push(`Solde invalide pour le compte ${i + 1}.`));
    accounts.forEach((a, i) => a.date && a.date > TODAY && errs.push(`La date du solde du compte ${i + 1} ne peut pas être dans le futur.`));
    foreign.forEach((c) => !(rates[c]! > 0) && errs.push(`Indiquez le taux ${c} → ${base}.`));
    setErrors(errs);
    if (errs.length) return;
    onStart({ companyName: name, country: country || undefined, baseCurrency: base, vatRegistered: vat, accounts: accounts.map((a) => ({ ...a, currency: a.currency || base })), rates });
  };

  return (
    <div ref={ref} className="mx-auto max-w-xl space-y-6 p-5 sm:p-8">
      <Tour steps={steps} open={tour} onClose={() => { setTour(false); setSeen(); }} />
      <div>
        <button onClick={() => setTour(true)} className="float-right inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted">
          <MousePointerClick className="size-4" /> Guide
        </button>
        <h3 className="font-display text-3xl">Commençons par l'essentiel</h3>
        <p className="mt-2 text-muted-foreground">Deux minutes, une seule fois. Pas besoin de connaître votre régime fiscal pour commencer.</p>
      </div>

      <div className="space-y-4">
        <div data-tour="setup-name"><Field label="Nom de votre activité">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Studio Martin" autoComplete="organization" />
        </Field></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pays (facultatif)">
            <input className={inputCls} value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Ex. Maroc" autoComplete="country-name" />
          </Field>
          <div data-tour="setup-currency"><Field label="Devise principale" hint="Celle de vos totaux. Elle ne dépend pas du pays.">
            <select className={inputCls} value={base} onChange={(e) => setBase(e.target.value)}>
              <option value="">Choisir…</option>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
            </select>
          </Field></div>
        </div>
        <label data-tour="setup-vat" className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={vat} onChange={(e) => setVat(e.target.checked)} /> Je facture la TVA (je peux la récupérer sur mes achats)
        </label>
      </div>

      <div className="space-y-3">
        <div>
          <p className="font-semibold">Vos comptes et leur solde aujourd'hui</p>
          <p className="text-sm text-muted-foreground">Le montant affiché par votre banque ce matin. Boussole part de là. Vous pouvez aussi partir d'un solde plus ancien (ex. au 1er du mois) et saisir ensuite les opérations depuis cette date.</p>
        </div>
        {accounts.map((a, i) => (
          <div key={i} data-tour={i === 0 ? "setup-account" : undefined} className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex gap-2">
              <input className={inputCls} value={a.name} onChange={(e) => setAcc(i, { name: e.target.value })} aria-label="Nom du compte" placeholder="Nom du compte" />
              {accounts.length > 1 && (
                <button onClick={() => setAccounts(accounts.filter((_, j) => j !== i))} aria-label="Retirer ce compte" className="rounded-xl p-2 text-muted-foreground hover:bg-muted">
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <select className={inputCls} value={a.kind} onChange={(e) => setAcc(i, { kind: e.target.value as AccountDraft["kind"] })} aria-label="Type de compte">
                <option value="banque">Banque</option>
                <option value="especes">Espèces</option>
              </select>
              <select className={inputCls} value={a.currency || base} onChange={(e) => setAcc(i, { currency: e.target.value })} aria-label="Devise du compte">
                {!base && !a.currency && <option value="">Devise…</option>}
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
              <input type="number" inputMode="decimal" step="0.01" className={`${inputCls} col-span-2 sm:col-span-1`} value={Number.isFinite(a.balance) && a.balance !== 0 ? a.balance : ""} placeholder="Solde" onChange={(e) => setAcc(i, { balance: e.target.value === "" ? 0 : Number(e.target.value) })} aria-label="Solde aujourd'hui" />
              <label className="col-span-2 flex items-center gap-2 text-sm text-muted-foreground sm:col-span-3">
                Solde au matin du
                <input type="date" max={TODAY} className="rounded-lg border border-border bg-card px-2 py-1 text-foreground" value={a.date ?? TODAY} onChange={(e) => setAcc(i, { date: e.target.value || undefined })} aria-label="Date du solde" />
              </label>
            </div>
          </div>
        ))}
        <button data-tour="setup-add-account" onClick={() => setAccounts([...accounts, { name: "", kind: "banque", currency: base, balance: 0 }])} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          <Plus className="size-4" /> Ajouter un compte (épargne, espèces, autre devise…)
        </button>
      </div>

      {foreign.length > 0 && (
        <div className="space-y-3 rounded-2xl bg-warning/10 p-4">
          <p className="text-sm">Pour additionner vos comptes, Boussole a besoin du taux de change du jour. Il n'en invente jamais.</p>
          {foreign.map((c) => (
            <Field key={c} label={`1 ${c} = combien de ${base} ?`} hint={`Ex. le taux affiché par votre banque. ${currencyInfo(c)?.name ?? ""}`}>
              <input type="number" step="0.0001" min={0} className={inputCls} value={rates[c] ?? ""} onChange={(e) => setRates({ ...rates, [c]: Number(e.target.value) })} />
            </Field>
          ))}
        </div>
      )}

      <Errors list={errors} />
      <PrimaryButton data-tour="setup-start" onClick={submit}>Commencer</PrimaryButton>
      <p className="text-center text-xs text-muted-foreground">
        Vos données restent uniquement dans ce navigateur, sur cet appareil.{" "}
        <button onClick={onExample} className="font-semibold text-primary underline-offset-2 hover:underline">Ou explorer un exemple fictif</button>
      </p>
    </div>
  );
}
