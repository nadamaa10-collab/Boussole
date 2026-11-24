import { useState } from "react";
import { BookOpen, ChartLine, FileText, Home, LayoutGrid, PiggyBank, Plus, Repeat, RotateCcw, Scale } from "lucide-react";
import { formatDateFr } from "@/lib/finance";
import { useDemo, TODAY } from "@/components/demo/store";
import { HomeTab } from "@/components/demo/HomeTab";
import { TresorerieTab } from "@/components/demo/TresorerieTab";
import { FacturesTab } from "@/components/demo/FacturesTab";
import { RentabiliteTab } from "@/components/demo/RentabiliteTab";
import { BudgetsTab, JournalTab, RecurrencesTab } from "@/components/demo/MoreTabs";
import { AddSheet } from "@/components/demo/AddSheet";
import { CurrencyPicker } from "@/components/demo/CurrencyPicker";
import { Sheet } from "@/components/demo/ui";

const TABS = [
  { id: "accueil", label: "Accueil", icon: Home },
  { id: "tresorerie", label: "Trésorerie", icon: ChartLine },
  { id: "factures", label: "Factures", icon: FileText },
  { id: "rentabilite", label: "Rentabilité", icon: Scale },
  { id: "budgets", label: "Budgets", icon: PiggyBank },
  { id: "recurrences", label: "Récurrences", icon: Repeat },
  { id: "journal", label: "Journal", icon: BookOpen },
] as const;
type TabId = (typeof TABS)[number]["id"];
const MOBILE_MAIN: TabId[] = ["accueil", "tresorerie", "factures", "rentabilite"];

export function DemoApp() {
  const demo = useDemo();
  const [tab, setTab] = useState<TabId>("accueil");
  const [adding, setAdding] = useState(false);
  const [picking, setPicking] = useState(false);
  const [more, setMore] = useState(false);
  const current = TABS.find((t) => t.id === tab)!;

  const go = (id: string) => {
    setTab(id as TabId);
    setMore(false);
    document.getElementById("demo-app")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div id="demo-app" className="relative scroll-mt-20 overflow-clip rounded-3xl border border-border bg-background shadow-float">
      {/* Barre supérieure */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
        <div>
          <p className="font-display text-lg leading-tight">{demo.data.settings.companyName}</p>
          <p className="text-xs text-muted-foreground">Aujourd'hui, {formatDateFr(TODAY)} · données fictives, rien n'est enregistré</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPicking(true)} className="rounded-full border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted" aria-label={`Devise de pilotage : ${demo.base}. Changer`}>
            {demo.base} ▾
          </button>
          <button onClick={demo.actions.reset} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Réinitialiser la démo" title="Réinitialiser la démo">
            <RotateCcw className="size-4" />
          </button>
          <button onClick={() => setAdding(true)} className="hidden items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 md:inline-flex">
            <Plus className="size-4" /> Ajouter
          </button>
        </div>
      </div>

      {/* Onglets (tablette et ordinateur) */}
      <nav aria-label="Sections de la démo" className="scrollbar-none hidden gap-1 overflow-x-auto border-b border-border bg-card px-4 md:flex sm:px-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </nav>

      <div className="min-h-[560px] p-3 pb-8 sm:p-6">
        <h2 className="mb-4 font-display text-2xl md:hidden">{current.label}</h2>
        {tab === "accueil" && <HomeTab demo={demo} goTo={go} />}
        {tab === "tresorerie" && <TresorerieTab demo={demo} />}
        {tab === "factures" && <FacturesTab demo={demo} />}
        {tab === "rentabilite" && <RentabiliteTab demo={demo} />}
        {tab === "budgets" && <BudgetsTab demo={demo} />}
        {tab === "recurrences" && <RecurrencesTab demo={demo} />}
        {tab === "journal" && <JournalTab demo={demo} />}
      </div>

      {/* Navigation du bas (téléphone) */}
      <nav aria-label="Navigation de la démo" className="sticky inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {MOBILE_MAIN.slice(0, 2).map((id) => <MobileTab key={id} id={id} active={tab === id} onClick={() => setTab(id)} />)}
        <div className="flex items-center justify-center">
          <button onClick={() => setAdding(true)} aria-label="Ajouter une opération" className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-float">
            <Plus className="size-6" />
          </button>
        </div>
        <MobileTab id="factures" active={tab === "factures"} onClick={() => setTab("factures")} />
        <button onClick={() => setMore(true)} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${!MOBILE_MAIN.slice(0, 3).includes(tab) ? "text-primary" : "text-muted-foreground"}`}>
          <LayoutGrid className="size-5" /> Plus
        </button>
      </nav>

      <Sheet open={more} onClose={() => setMore(false)} title="Plus">
        <ul className="grid grid-cols-2 gap-2">
          {TABS.filter((t) => !["accueil", "tresorerie", "factures"].includes(t.id)).map((t) => (
            <li key={t.id}>
              <button onClick={() => go(t.id)} className="flex w-full flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4 text-left font-semibold">
                <t.icon className="size-5 text-primary" /> {t.label}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <AddSheet demo={demo} open={adding} onClose={() => setAdding(false)} />
      <CurrencyPicker demo={demo} open={picking} onClose={() => setPicking(false)} />

      {/* Notifications */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {demo.toasts.map((t) => (
          <p key={t.id} className={`animate-sheet rounded-full px-4 py-2 text-sm font-semibold shadow-float ${t.tone === "error" ? "bg-danger text-white" : "bg-ink text-ink-foreground"}`}>{t.text}</p>
        ))}
      </div>
    </div>
  );
}

function MobileTab({ id, active, onClick }: { id: TabId; active: boolean; onClick: () => void }) {
  const t = TABS.find((x) => x.id === id)!;
  return (
    <button onClick={onClick} aria-current={active ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}>
      <t.icon className="size-5" /> {t.label}
    </button>
  );
}
