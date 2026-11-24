import { useState } from "react";
import { BookOpen, Check, CloudOff, Loader2, ChartLine, FileText, Home, LayoutGrid, MousePointerClick, PiggyBank, Plus, Repeat, Scale, Settings } from "lucide-react";
import { formatDateFr, type FinanceData } from "@/lib/finance";
import { DraftContext, useDemo, useDemoRoot, TODAY } from "@/components/demo/store";
import { SetupScreen } from "@/components/demo/SetupScreen";
import { SettingsSheet } from "@/components/demo/SettingsSheet";
import { Tour, useTourSeen, type TourStep } from "@/components/demo/Tour";
import { HomeTab } from "@/components/demo/HomeTab";
import { TresorerieTab } from "@/components/demo/TresorerieTab";
import { FacturesTab } from "@/components/demo/FacturesTab";
import { RentabiliteTab } from "@/components/demo/RentabiliteTab";
import { BudgetsTab, JournalTab, RecurrencesTab } from "@/components/demo/MoreTabs";
import { AddSheet, type AddMode } from "@/components/demo/AddSheet";
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

type Root = ReturnType<typeof useDemoRoot>;

/** Où sont gardées les données, et si la dernière modification est bien enregistrée. */
function SaveBadge({ root }: { root: Root }) {
  const { storage, saving, saveError } = root;
  if (storage === "aucun" || saveError) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger" role="status">
        <CloudOff className="size-3.5" /> {saveError ?? "Non enregistré : ne rechargez pas la page"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status" title={storage === "compte" ? "Gardé sur votre compte Claude : vous retrouvez vos données après un rechargement ou sur un autre appareil." : "Gardé dans ce navigateur, sur cet appareil."}>
      {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5 text-success" />}
      {saving ? "Enregistrement…" : storage === "compte" ? "Enregistré sur votre compte" : "Enregistré sur cet appareil"}
    </span>
  );
}

export function DemoApp() {
  const root = useDemoRoot();
  if (!root.ready) {
    return (
      <div id="demo-app" className="flex min-h-[300px] scroll-mt-20 items-center justify-center gap-2 rounded-3xl border border-border bg-background text-muted-foreground shadow-float">
        <Loader2 className="size-5 animate-spin" /> Chargement de vos données…
      </div>
    );
  }
  return (
    <DraftContext.Provider value={root.draftApi}>
      {!root.data ? (
        <div id="demo-app" className="scroll-mt-20 rounded-3xl border border-border bg-background shadow-float">
          <div className="flex justify-end px-5 pt-4 sm:px-8"><SaveBadge root={root} /></div>
          <SetupScreen onStart={root.start} onExample={root.loadExample} />
        </div>
      ) : (
        <Workspace root={root} data={root.data} setData={root.setData} clear={root.clear} />
      )}
    </DraftContext.Provider>
  );
}

function Workspace({ root, data, setData, clear }: { root: Root; data: FinanceData; setData: (d: FinanceData) => void; clear: () => void }) {
  const demo = useDemo(data, setData, clear);
  const [addMode, setAddMode] = useState<AddMode>("menu");
  const pendingDraft = root.drafts["facture-client"] ? "recette" : root.drafts["facture-fournisseur"] ? "depense" : null;
  const [settings, setSettings] = useState(false);
  const [seen, setSeen] = useTourSeen("app");
  const [tour, setTour] = useState(!seen && !data.demo);
  const [tab, setTab] = useState<TabId>("accueil");
  const [adding, setAdding] = useState(false);
  const [picking, setPicking] = useState(false);
  const [more, setMore] = useState(false);
  const current = TABS.find((t) => t.id === tab)!;

  const steps: TourStep[] = [
    { onEnter: () => setTab("accueil"), target: ["[data-tour=cash]"], title: "Votre argent disponible", text: "Le total de vos comptes aujourd'hui. Il bouge uniquement quand un paiement est réellement reçu ou effectué." },
    { target: ["[data-tour=add-desktop]", "[data-tour=add-mobile]"], title: "Le bouton « + Ajouter »", text: "Votre geste quotidien. Une facture envoyée, une dépense, un paiement reçu, un transfert : une ligne suffit, en moins de 15 secondes." },
    { target: ["[data-tour=upcoming]"], title: "Ce qui vous attend", text: "Ce qui va entrer et sortir dans les prochaines semaines, d'après les dates d'échéance que vous indiquez. Si votre solde risque de passer sous zéro, une alerte apparaît ici." },
    { target: ["[data-tour=priorities]"], title: "Vos priorités du jour", text: "Les clients à relancer, les fournisseurs à payer et les budgets qui débordent remontent ici automatiquement." },
    { onEnter: () => setTab("factures"), target: ["[data-tour=invoices]"], title: "Retrouver et modifier", text: "Toutes vos factures (Recettes) et vos dépenses sont ici, payées ou non. Touchez-en une pour la modifier, la supprimer ou enregistrer un paiement, même partiel." },
    { onEnter: () => setTab("recurrences"), target: ["[data-tour=rec-add]"], title: "Vos charges qui reviennent", text: "Loyer, abonnements, assurance : ajoutez-les une seule fois. Elles seront prévues automatiquement chaque mois. Vous confirmerez chaque paiement quand il sera fait." },
    { onEnter: () => setTab("tresorerie"), target: ["[data-tour=chart]"], title: "Votre trésorerie jour par jour", text: "Le solde prévu date par date. Touchez un point pour voir les mouvements du jour. Le scénario « Prudent » décale les paiements incertains." },
    { target: ["[data-tour=simulate]"], title: "Et si… ?", text: "Testez un retard client, une grosse dépense ou un nouveau contrat, sans rien modifier dans vos données." },
    { onEnter: () => setTab("rentabilite"), target: ["[data-tour=profit-detail]"], title: "Ce que votre activité gagne", text: "Les ventes et charges du mois, même pas encore payées. C'est différent de l'argent en banque, et c'est normal." },
    { onEnter: () => setTab("budgets"), target: ["[data-tour=budget-add]"], title: "Vos budgets", text: "Fixez un plafond par catégorie (ex. Logiciels). Il passe à l'orange à 80 % et au rouge au-delà de 100 %." },
    { onEnter: () => setTab("accueil"), target: ["[data-tour=settings]"], title: "Les paramètres", text: "Ajoutez un compte, vos impôts et cotisations (pour voir ce qu'il vous reste vraiment), vos objectifs. Vous pouvez aussi tout effacer ici." },
    { target: ["[data-tour=currency]"], title: "Votre devise", text: "Changez de devise d'affichage quand vous voulez. Les montants d'origine de vos factures sont conservés." },
    { target: ["[data-tour=guide]"], title: "Ce guide reste disponible", text: "Cliquez ici pour le revoir à tout moment. À vous de jouer : commencez par ajouter une facture ou une dépense." },
  ];

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
          <p className="text-xs text-muted-foreground">
            Aujourd'hui, {formatDateFr(TODAY)} ·{" "}
            {demo.data.demo ? (
              <>exemple fictif · <button onClick={clear} className="font-semibold text-primary">repartir de zéro</button></>
            ) : (
              "vos données de test"
            )}
          </p>
          <div className="mt-1"><SaveBadge root={root} /></div>
        </div>
        <div className="flex items-center gap-2">
          <button data-tour="guide" onClick={() => setTour(true)} className="inline-flex items-center gap-1.5 rounded-full p-2 text-sm font-semibold text-muted-foreground hover:bg-muted sm:px-3" aria-label="Revoir le guide" title="Revoir le guide">
            <MousePointerClick className="size-4" /> <span className="hidden sm:inline">Guide</span>
          </button>
          <button data-tour="currency" onClick={() => setPicking(true)} className="rounded-full border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted" aria-label={`Devise de pilotage : ${demo.base}. Changer`}>
            {demo.base} ▾
          </button>
          <button data-tour="settings" onClick={() => setSettings(true)} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Paramètres" title="Paramètres">
            <Settings className="size-4" />
          </button>
          <button data-tour="add-desktop" onClick={() => setAdding(true)} className="hidden items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 md:inline-flex">
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
        {pendingDraft && !adding && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-3 text-sm">
            <span>Vous aviez commencé {pendingDraft === "recette" ? "une facture client" : "une dépense"} sans l'enregistrer. Elle a été gardée.</span>
            <span className="flex gap-2">
              <button onClick={() => root.draftApi.set(pendingDraft === "recette" ? "facture-client" : "facture-fournisseur", undefined)} className="rounded-full px-3 py-1.5 font-semibold text-muted-foreground hover:bg-muted">Abandonner</button>
              <button onClick={() => { setAddMode(pendingDraft); setAdding(true); }} className="rounded-full bg-primary px-4 py-1.5 font-semibold text-primary-foreground">Reprendre</button>
            </span>
          </div>
        )}
        {tab === "accueil" && <HomeTab demo={demo} goTo={go} onAdd={() => setAdding(true)} />}
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
          <button data-tour="add-mobile" onClick={() => setAdding(true)} aria-label="Ajouter une opération" className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-float">
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

      <AddSheet demo={demo} open={adding} initialMode={addMode} onClose={() => { setAdding(false); setAddMode("menu"); }} />
      <CurrencyPicker demo={demo} open={picking} onClose={() => setPicking(false)} />
      <SettingsSheet demo={demo} open={settings} onClose={() => setSettings(false)} />
      <Tour steps={steps} open={tour} onClose={() => { setTour(false); setSeen(); setTab("accueil"); }} />

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
