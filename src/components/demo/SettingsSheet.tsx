import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { addDays, formatDateFr, type Account, type Levy } from "@/lib/finance";
import type { Demo } from "./store";
import { TODAY, newId } from "./store";
import { CurrencySelect } from "./SetupScreen";
import { Errors, Field, Sheet, inputCls } from "./ui";

export function SettingsSheet({ demo, open, onClose }: { demo: Demo; open: boolean; onClose: () => void }) {
  const { data, base, fmt, actions } = demo;
  const s = data.settings;
  const [acc, setAcc] = useState({ name: "", kind: "banque" as Account["kind"], currency: base, balance: 0, rate: 0 });
  const [levy, setLevy] = useState({ label: "", rate: 0, base: "chiffre_affaires" as Levy["base"], source: "", frequency: "trimestrielle" as NonNullable<Levy["frequency"]>, dueDay: 31 });
  const [errors, setErrors] = useState<string[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);
  const [editAcc, setEditAcc] = useState<{ id: string; balance: number; date: string } | null>(null);
  const needsRate = acc.currency !== base && !data.rates.some((r) => (r.from === acc.currency && r.to === base) || (r.to === acc.currency && r.from === base));

  const addAccount = () => {
    const errs: string[] = [];
    if (!acc.name.trim()) errs.push("Nommez le compte.");
    if (needsRate && !(acc.rate > 0)) errs.push(`Indiquez le taux ${acc.currency} → ${base}.`);
    setErrors(errs);
    if (errs.length) return;
    actions.addAccount(
      { id: newId("compte"), name: acc.name.trim(), kind: acc.kind, currency: acc.currency, openingBalance: acc.balance, openingDate: addDays(TODAY, -1), source: "manuel" },
      needsRate ? [{ from: acc.currency, to: base, rate: acc.rate, date: TODAY, source: "Saisie manuelle" }] : [],
    );
    setAcc({ name: "", kind: "banque", currency: base, balance: 0, rate: 0 });
  };

  const addLevy = () => {
    const errs: string[] = [];
    if (!levy.label.trim()) errs.push("Nommez le prélèvement (ex. cotisations sociales).");
    if (!(levy.rate > 0 && levy.rate < 100)) errs.push("Le taux doit être entre 0 et 100 %.");
    if (!levy.source.trim()) errs.push("Indiquez d'où vient ce taux (site officiel, comptable…) pour pouvoir le vérifier.");
    setErrors(errs);
    if (errs.length) return;
    actions.addLevy({ label: levy.label.trim(), rate: levy.rate / 100, base: levy.base, validFrom: `${TODAY.slice(0, 4)}-01-01`, source: levy.source.trim(), frequency: levy.frequency, dueDay: levy.dueDay });
    setLevy({ label: "", rate: 0, base: "chiffre_affaires", source: "", frequency: "trimestrielle", dueDay: 31 });
  };

  return (
    <Sheet open={open} onClose={onClose} title="Paramètres">
      <div className="space-y-6">
        <section className="space-y-3">
          <Field label="Nom de l'activité">
            <input className={inputCls} value={s.companyName} onChange={(e) => actions.updateSettings({ companyName: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.vatRegistered} onChange={(e) => actions.updateSettings({ vatRegistered: e.target.checked })} /> Je facture la TVA
          </label>
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold">Comptes</h3>
          <ul className="divide-y divide-border rounded-2xl bg-card px-4">
            {data.accounts.map((a) =>
              editAcc?.id === a.id ? (
                <li key={a.id} className="space-y-2 py-3 text-sm">
                  <p className="font-semibold">{a.name} : solde de départ</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label={`Solde (${a.currency})`}>
                      <input type="number" step="0.01" className={inputCls} value={editAcc.balance} onChange={(e) => setEditAcc({ ...editAcc, balance: Number(e.target.value) })} />
                    </Field>
                    <Field label="Au matin du">
                      <input type="date" max={TODAY} className={inputCls} value={editAcc.date} onChange={(e) => setEditAcc({ ...editAcc, date: e.target.value })} />
                    </Field>
                  </div>
                  <p className="text-xs text-muted-foreground">Pour saisir des opérations plus anciennes, reculez cette date et indiquez le solde de ce jour-là (relevé bancaire). Les paiements antérieurs à cette date sont considérés comme déjà inclus dans le solde.</p>
                  <div className="flex gap-2">
                    <button onClick={() => { actions.updateAccount(a.id, { name: a.name, openingBalance: editAcc.balance, openingDate: addDays(editAcc.date, -1) }); setEditAcc(null); }} className="rounded-full bg-primary px-4 py-1.5 font-semibold text-primary-foreground">Enregistrer</button>
                    <button onClick={() => setEditAcc(null)} className="px-3 py-1.5">Annuler</button>
                  </div>
                </li>
              ) : (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span>{a.name} <span className="text-muted-foreground">· {a.currency}</span></span>
                  <span className="flex items-center gap-2 text-right text-muted-foreground">
                    {fmt(a.openingBalance, a.currency)} le {formatDateFr(addDays(a.openingDate, 1))} au matin
                    <button onClick={() => setEditAcc({ id: a.id, balance: a.openingBalance, date: addDays(a.openingDate, 1) })} aria-label={`Modifier le solde de départ de ${a.name}`} className="rounded-full p-1.5 hover:bg-muted"><Pencil className="size-3.5" /></button>
                  </span>
                </li>
              ),
            )}
          </ul>
          <div className="space-y-2 rounded-2xl border border-border p-3">
            <input className={inputCls} placeholder="Nom du nouveau compte" value={acc.name} onChange={(e) => setAcc({ ...acc, name: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <select className={inputCls} value={acc.kind} onChange={(e) => setAcc({ ...acc, kind: e.target.value as Account["kind"] })} aria-label="Type">
                <option value="banque">Banque</option>
                <option value="especes">Espèces</option>
              </select>
              <CurrencySelect value={acc.currency} onChange={(c) => setAcc({ ...acc, currency: c })} label="Devise" />
              <input type="number" step="0.01" className={inputCls} placeholder="Solde du jour" value={acc.balance || ""} onChange={(e) => setAcc({ ...acc, balance: Number(e.target.value) })} />
            </div>
            {needsRate && (
              <Field label={`1 ${acc.currency} = combien de ${base} ?`}>
                <input type="number" step="0.0001" className={inputCls} value={acc.rate || ""} onChange={(e) => setAcc({ ...acc, rate: Number(e.target.value) })} />
              </Field>
            )}
            <button onClick={addAccount} className="text-sm font-semibold text-primary">Ajouter ce compte</button>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold">Impôts et cotisations</h3>
          <p className="text-sm text-muted-foreground">Facultatif. Sans eux, Boussole affiche un résultat « avant prélèvements ». Il n'invente jamais de taux.</p>
          {s.levies.map((l) => (
            <div key={l.label} className="flex items-center justify-between rounded-xl bg-card px-3 py-2 text-sm">
              <span>{l.label} · {Math.round(l.rate * 1000) / 10} % {l.base === "chiffre_affaires" ? "du CA" : "du résultat"} · {l.frequency === "mensuelle" ? "mensuel" : l.frequency === "annuelle" ? "annuel" : "trimestriel"}<span className="block text-xs text-muted-foreground">{l.source}</span></span>
              <button onClick={() => actions.removeLevy(l.label)} aria-label={`Retirer ${l.label}`} className="p-2 text-muted-foreground"><Trash2 className="size-4" /></button>
            </div>
          ))}
          <div className="space-y-2 rounded-2xl border border-border p-3">
            <input className={inputCls} placeholder="Ex. Cotisations sociales" value={levy.label} onChange={(e) => setLevy({ ...levy, label: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" step="0.1" className={inputCls} placeholder="Taux en %" value={levy.rate || ""} onChange={(e) => setLevy({ ...levy, rate: Number(e.target.value) })} />
              <select className={inputCls} value={levy.base} onChange={(e) => setLevy({ ...levy, base: e.target.value as Levy["base"] })} aria-label="Calculé sur">
                <option value="chiffre_affaires">du chiffre d'affaires</option>
                <option value="resultat">du résultat</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select className={inputCls} value={levy.frequency} onChange={(e) => setLevy({ ...levy, frequency: e.target.value as NonNullable<Levy["frequency"]> })} aria-label="Payé chaque">
                <option value="mensuelle">Payé chaque mois</option>
                <option value="trimestrielle">Payé chaque trimestre</option>
                <option value="annuelle">Payé chaque année</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                le
                <input type="number" min={1} max={31} className={`${inputCls} w-20`} value={levy.dueDay} onChange={(e) => setLevy({ ...levy, dueDay: Math.max(1, Math.min(31, Number(e.target.value) || 31)) })} aria-label="Jour de paiement" />
                <span>du mois suivant</span>
              </label>
            </div>
            <p className="text-xs text-muted-foreground">Ex. trimestriel : les cotisations d'octobre à décembre sont payées en janvier, le jour indiqué (31 = dernier jour du mois). Vérifiez la date réelle de votre régime.</p>
            <input className={inputCls} placeholder="Source du taux (ex. site officiel, mon comptable)" value={levy.source} onChange={(e) => setLevy({ ...levy, source: e.target.value })} />
            <button onClick={addLevy} className="text-sm font-semibold text-primary">Ajouter</button>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">Objectifs (facultatif)</h3>
          <div className="grid grid-cols-2 gap-2">
            <Field label={`Rémunération visée / mois (${base})`}>
              <input type="number" className={inputCls} value={s.targetMonthlyPay ?? ""} onChange={(e) => actions.updateSettings({ targetMonthlyPay: e.target.value ? Number(e.target.value) : undefined })} />
            </Field>
            <Field label="Charges variables (% du CA)">
              <input type="number" className={inputCls} value={s.variableCostRate !== undefined ? Math.round(s.variableCostRate * 100) : ""} onChange={(e) => actions.updateSettings({ variableCostRate: e.target.value ? Number(e.target.value) / 100 : undefined })} />
            </Field>
          </div>
        </section>

        {data.rates.length > 0 && (
          <section className="space-y-2">
            <h3 className="font-semibold">Taux de change enregistrés</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {data.rates.filter((r) => !r.demo).slice(-8).map((r, i) => <li key={i}>1 {r.from} = {r.rate} {r.to} · {formatDateFr(r.date)} · {r.source}</li>)}
              {data.rates.some((r) => r.demo) && <li>Taux de démonstration fictifs (exemple)</li>}
            </ul>
          </section>
        )}

        <Errors list={errors} />

        <section className="rounded-2xl border border-danger/30 p-4">
          {!confirmReset ? (
            <button onClick={() => setConfirmReset(true)} className="text-sm font-semibold text-danger">Tout effacer et recommencer</button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">Toutes les données saisies sur cet appareil seront effacées. Continuer ?</p>
              <button className="w-full rounded-full bg-danger px-5 py-3 font-semibold text-white" onClick={() => { actions.reset(); onClose(); }}>Oui, tout effacer</button>
              <button onClick={() => setConfirmReset(false)} className="w-full py-2 text-sm">Annuler</button>
            </div>
          )}
        </section>
      </div>
    </Sheet>
  );
}
