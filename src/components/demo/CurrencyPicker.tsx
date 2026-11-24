import { useState } from "react";
import { Search } from "lucide-react";
import { DEMO_CURRENCIES, previewBaseCurrencyChange, searchCurrencies } from "@/lib/finance";
import type { Demo } from "./store";
import { TODAY } from "./store";
import { Errors, PrimaryButton, Sheet, inputCls } from "./ui";

export function CurrencyPicker({ demo, open, onClose }: { demo: Demo; open: boolean; onClose: () => void }) {
  const { data, base, actions } = demo;
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const list = searchCurrencies(q);
  const preview = target ? previewBaseCurrencyChange(data, target, TODAY) : null;
  const close = () => {
    setTarget(null);
    setQ("");
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title={preview ? `Passer en ${target}` : "Devise de pilotage"}>
      {!preview ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            La devise dans laquelle Boussole affiche vos totaux. Elle ne dépend pas de votre pays, et vos factures gardent leur devise d'origine.
          </p>
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input autoFocus className={`${inputCls} pl-9`} placeholder="Euro, USD, $, dirham…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-2xl bg-card">
            {list.map((c) => {
              const available = DEMO_CURRENCIES.includes(c.code);
              return (
                <li key={c.code}>
                  <button
                    disabled={!available || c.code === base}
                    onClick={() => setTarget(c.code)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left disabled:opacity-50"
                  >
                    <span><span className="font-semibold">{c.code}</span> · {c.name}</span>
                    <span className="text-sm text-muted-foreground">{c.code === base ? "actuelle" : available ? c.symbol : "pas de taux de démo"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-2 text-sm">
            {preview.consequences.map((c) => <li key={c} className="flex gap-2"><span className="text-primary">•</span>{c}</li>)}
          </ul>
          {preview.referenceQuote && (
            <p className="rounded-xl bg-warning/15 p-3 text-sm">
              Taux utilisé : 1 {base} = {preview.referenceQuote.rate.toFixed(4)} {target}
              <span className="block text-xs">{preview.referenceQuote.source}. Dans la vraie application, vous choisirez une source officielle ou saisirez vos taux.</span>
            </p>
          )}
          <p className="text-sm text-muted-foreground">{preview.invoices.filter((i) => i.currency !== target).length} factures verront leur contre-valeur recalculée au taux de leur date. Leurs montants d'origine ne changent pas.</p>
          <Errors list={preview.missingRates.map((m) => `Taux manquant : ${m}`)} />
          <PrimaryButton disabled={!preview.canApply} onClick={() => { actions.changeCurrency(target!); close(); }}>Confirmer le passage en {target}</PrimaryButton>
          <button className="w-full py-2 text-sm text-muted-foreground" onClick={() => setTarget(null)}>← Choisir une autre devise</button>
        </div>
      )}
    </Sheet>
  );
}
