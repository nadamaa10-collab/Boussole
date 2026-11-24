import { useState } from "react";
import { Search } from "lucide-react";
import { findRate, previewBaseCurrencyChange, searchCurrencies, type FxRate } from "@/lib/finance";
import type { Demo } from "./store";
import { TODAY } from "./store";
import { Errors, Field, PrimaryButton, Sheet, inputCls } from "./ui";

const APPLIED_TO_HISTORY = "Saisie manuelle (taux du jour appliqué à l'historique)";

export function CurrencyPicker({ demo, open, onClose }: { demo: Demo; open: boolean; onClose: () => void }) {
  const { data, base, actions } = demo;
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const [typed, setTyped] = useState<Record<string, number>>({});
  const list = searchCurrencies(q);

  // Devises présentes dans les données, à convertir vers la nouvelle devise.
  const used = [...new Set([base, ...data.accounts.map((a) => a.currency), ...data.invoices.map((i) => i.currency), ...data.recurrences.map((r) => r.currency)])];
  const earliest = [TODAY, ...data.accounts.map((a) => a.openingDate), ...data.invoices.map((i) => i.issueDate), ...data.payments.map((p) => p.date), ...data.movements.map((m) => m.date)].sort()[0]!;
  const missing = target ? used.filter((c) => c !== target && !findRate(data.rates, c, target, TODAY)) : [];
  const extra: FxRate[] = missing.filter((c) => typed[c]! > 0).map((c) => ({ from: c, to: target!, rate: typed[c]!, date: earliest, source: APPLIED_TO_HISTORY }));
  const ready = target && missing.every((c) => typed[c]! > 0);
  const preview = ready ? previewBaseCurrencyChange({ ...data, rates: [...data.rates, ...extra] }, target!, TODAY, { allowReferenceRate: true }) : null;

  const close = () => {
    setTarget(null);
    setTyped({});
    setQ("");
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title={target ? `Passer en ${target}` : "Devise de pilotage"}>
      {!target ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            La devise dans laquelle Boussole affiche vos totaux. Elle ne dépend pas de votre pays, et vos factures gardent leur devise d'origine.
          </p>
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input autoFocus className={`${inputCls} pl-9`} placeholder="Euro, USD, $, dirham…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-2xl bg-card">
            {list.map((c) => (
              <li key={c.code}>
                <button disabled={c.code === base} onClick={() => setTarget(c.code)} className="flex w-full items-center justify-between px-4 py-3 text-left disabled:opacity-50">
                  <span><span className="font-semibold">{c.code}</span> · {c.name}</span>
                  <span className="text-sm text-muted-foreground">{c.code === base ? "actuelle" : c.symbol}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-4">
          {missing.length > 0 && (
            <div className="space-y-3 rounded-2xl bg-warning/10 p-4">
              <p className="text-sm">Boussole n'invente jamais de taux. Indiquez ceux du jour :</p>
              {missing.map((c) => (
                <Field key={c} label={`1 ${c} = combien de ${target} ?`}>
                  <input type="number" step="0.0001" min={0} className={inputCls} value={typed[c] ?? ""} onChange={(e) => setTyped({ ...typed, [c]: Number(e.target.value) })} />
                </Field>
              ))}
              <p className="text-xs text-muted-foreground">Faute d'historique, ce taux sera aussi utilisé pour vos opérations passées. C'est indiqué dans les détails.</p>
            </div>
          )}
          {preview && (
            <>
              <ul className="space-y-2 text-sm">
                {preview.consequences.map((c) => <li key={c} className="flex gap-2"><span className="text-primary">•</span>{c}</li>)}
              </ul>
              {preview.referenceQuote && (
                <p className="rounded-xl bg-muted p-3 text-sm">
                  1 {base} = {preview.referenceQuote.rate.toFixed(4)} {target}
                  <span className="block text-xs text-muted-foreground">{preview.referenceQuote.source}</span>
                </p>
              )}
              <Errors list={preview.missingRates.map((m) => `Taux manquant : ${m}`)} />
            </>
          )}
          <PrimaryButton disabled={!preview?.canApply} onClick={() => { actions.changeCurrency(target, extra); close(); }}>Confirmer le passage en {target}</PrimaryButton>
          <button className="w-full py-2 text-sm text-muted-foreground" onClick={() => { setTarget(null); setTyped({}); }}>← Choisir une autre devise</button>
        </div>
      )}
    </Sheet>
  );
}
