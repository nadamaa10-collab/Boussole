import { useMemo } from "react";
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  Check,
  Coins,
  Compass,
  Globe2,
  LineChart,
  PiggyBank,
  Repeat,
  Scale,
  X,
} from "lucide-react";
import { Logo } from "@/components/finance/Logo";
import {
  buildDemoData,
  cashPosition,
  commitments,
  forecast,
  formatDateFr,
  formatMoney,
  profitability,
  startOfMonth,
  endOfMonth,
  monthKey,
} from "@/lib/finance";

/** Les trois bénéfices du positionnement. */
const BENEFITS = [
  {
    icon: Compass,
    title: "Sachez où vous en êtes",
    text: "Votre argent disponible compte par compte, ce que vos clients vous doivent, ce que vous devez encore régler. Sans jamais mélanger une facture envoyée avec de l'argent en banque.",
  },
  {
    icon: CalendarClock,
    title: "Anticipez les prochaines semaines",
    text: "Votre solde est projeté jour par jour selon les dates de paiement. Vous voyez à l'avance le jour où il risque de passer sous zéro, et pourquoi.",
  },
  {
    icon: Scale,
    title: "Prenez de meilleures décisions",
    text: "Ce que votre activité gagne vraiment, vos budgets qui préviennent avant de déborder, et une courte liste de choses à faire aujourd'hui.",
  },
];

const FEATURES = [
  { icon: LineChart, title: "Trésorerie chronologique", text: "Vue 7, 30 ou 90 jours, solde minimum, jours à risque, et un scénario prudent qui décale les paiements incertains." },
  { icon: BellRing, title: "Factures et relances", text: "Paiements partiels, retards calculés sur le reste dû : « Paiement partiel en retard — 2 000 restants », pas un statut contradictoire." },
  { icon: Coins, title: "Rentabilité ≠ trésorerie", text: "Une mission réalisée en novembre et payée en décembre compte dans le résultat de novembre et dans la trésorerie de décembre. Une seule fois." },
  { icon: Repeat, title: "Charges récurrentes", text: "Loyer, abonnements, assurance : prévus automatiquement, mais jamais considérés comme payés tant que vous ne l'avez pas confirmé." },
  { icon: PiggyBank, title: "Budgets qui préviennent", text: "Alerte à 80 %, dépassement à 100 % (seuils réglables), en distinguant ce qui est engagé et ce qui est déjà payé." },
  { icon: Globe2, title: "Votre devise, vos clients étrangers", text: "Choisissez votre devise de pilotage. Facturez en dollars, gardez un compte en euros : montants d'origine et taux conservés." },
];

const STEPS = [
  { n: "1", title: "Réglez l'essentiel", text: "Votre devise, vos comptes et leur solde du jour. Deux minutes, sans connaître votre régime fiscal." },
  { n: "2", title: "Notez au fil de l'eau", text: "Un bouton « + Ajouter » : une facture, une dépense, un paiement reçu. Moins de 15 secondes." },
  { n: "3", title: "Pilotez chaque matin", text: "Ce que vous avez, ce qui va entrer, ce qui va sortir, ce que vous gagnez, ce qu'il faut surveiller." },
];

const DOES = [
  "Suivre votre argent disponible, compte par compte et dans plusieurs devises",
  "Prévoir votre trésorerie selon les dates de paiement",
  "Suivre factures clients et fournisseurs, y compris les paiements partiels",
  "Estimer votre rentabilité et vos prélèvements, si vous les configurez",
  "Exporter vos données à tout moment",
];

const DOES_NOT = [
  "Remplacer votre logiciel de comptabilité ou votre expert-comptable",
  "Établir vos déclarations fiscales et sociales",
  "Inventer des taux d'imposition ou de change : chaque taux est saisi ou sourcé",
];

/** L'aperçu du hero est calculé par le vrai moteur sur les données de la démo : rien n'est inventé à la main. */
function useHeroPreview() {
  return useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const data = buildDemoData(today);
    const base = data.settings.baseCurrency;
    const fmt = (v: number) => formatMoney(v, base, data.settings.locale).replace(/,00(?=\s)/, "");
    const cash = cashPosition(data, today).total ?? 0;
    const f = forecast(data, { today, days: 30 });
    const { receivables } = commitments(data, today);
    const month = monthKey(today);
    const result = profitability(data, startOfMonth(month), endOfMonth(month)).operatingResult;
    const late = receivables.items.filter((i) => i.late);
    const values = f.points.map((p) => p.balance);
    const max = Math.max(...values, 0);
    const min = Math.min(...values, 0);
    return {
      fmt,
      cash,
      receivable: receivables.total ?? 0,
      result,
      min: f.min,
      bars: f.points.filter((_, i) => i % 3 === 0).map((p) => ({ date: p.date, h: ((p.balance - min) / (max - min || 1)) * 100, neg: p.balance < 0 })),
      late: late[0],
      lateCount: late.length,
    };
  }, []);
}

export function Landing() {
  const hero = useHeroPreview();

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Logo />
          <nav className="flex items-center gap-1 text-sm" aria-label="Navigation principale">
            <a href="#benefices" className="hidden rounded-full px-3 py-2 text-muted-foreground hover:text-foreground md:inline">Pourquoi Boussole</a>
            <a href="#fonctionnalites" className="hidden rounded-full px-3 py-2 text-muted-foreground hover:text-foreground md:inline">Fonctionnalités</a>
            <a href="#limites" className="hidden rounded-full px-3 py-2 text-muted-foreground hover:text-foreground lg:inline">Ce qu'il ne fait pas</a>
            <a href="#app" className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground hover:bg-primary/90">
              Ouvrir l'application <ArrowRight className="size-4" />
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="paper-grain relative">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-16 md:pt-24 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div className="animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
              <span className="size-1.5 rounded-full bg-accent" /> Pour freelances, indépendants et petites entreprises
            </p>
            <h1 className="mt-6 font-display text-5xl leading-[1.02] tracking-tight md:text-7xl">
              Votre argent,
              <br />
              <em className="relative font-normal italic text-primary">
                enfin clair.
                <svg viewBox="0 0 300 20" className="absolute -bottom-2 left-0 h-3 w-full text-accent" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M2 14 C 80 4, 200 4, 298 12" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                </svg>
              </em>
            </h1>
            <p className="mt-8 max-w-lg text-lg leading-relaxed text-muted-foreground">
              L'outil qui vous aide à comprendre où va votre argent et à anticiper ce qui vous attend. Chaque matin : ce que vous avez, ce qui va entrer, ce qui va sortir, ce que votre activité gagne et ce qu'il faut surveiller.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#app" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-soft transition-transform hover:-translate-y-0.5">
                Ouvrir l'application <ArrowRight className="size-4" />
              </a>
              <a href="#benefices" className="rounded-full px-5 py-3 font-semibold text-foreground hover:bg-muted">Voir ce qu'il fait</a>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Gratuit à tester · sans inscription · dans la devise de votre choix</p>
          </div>

          {/* Aperçu calculé par le moteur réel sur l'entreprise de démo */}
          <figure className="relative animate-rise [animation-delay:150ms]" aria-label="Aperçu du tableau de bord de démonstration">
            <div className="absolute -inset-6 rounded-[2rem] bg-accent/25 blur-3xl" />
            <div className="relative rotate-[1.5deg] rounded-3xl bg-ink p-7 text-ink-foreground shadow-float">
              <p className="text-sm text-ink-muted">Argent disponible aujourd'hui</p>
              <p className="mt-1 font-num text-5xl md:text-6xl">{hero.fmt(hero.cash)}</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-ink-soft p-4">
                  <p className="text-xs text-ink-muted">À recevoir des clients</p>
                  <p className="font-num text-2xl">{hero.fmt(hero.receivable)}</p>
                </div>
                <div className="rounded-2xl bg-ink-soft p-4">
                  <p className="text-xs text-ink-muted">Ce que l'activité gagne ce mois</p>
                  <p className="font-num text-2xl text-accent">{hero.fmt(hero.result)}</p>
                </div>
              </div>
              <p className="mt-5 text-xs text-ink-muted">Solde prévu sur 30 jours</p>
              {hero.min && hero.min.balance < 0 && (
                <p className="mt-1 text-xs text-ink-muted">
                  Point bas : <span className="font-semibold text-ink-foreground">{hero.fmt(hero.min.balance)}</span> le {formatDateFr(hero.min.date)}, alors que le mois est rentable.
                </p>
              )}
              <div className="mt-3 flex h-20 items-end gap-1.5" aria-hidden="true">
                {hero.bars.map((b) => (
                  <div key={b.date} className={`flex-1 rounded-t-md ${b.neg ? "bg-danger" : "bg-accent/80"}`} style={{ height: `${Math.max(6, b.h)}%` }} />
                ))}
              </div>
            </div>
            {hero.late && (
              <div className="absolute -bottom-6 -left-4 -rotate-2 rounded-2xl border border-border bg-card p-4 shadow-soft md:-left-10">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="size-2 rounded-full bg-danger" />
                  {hero.lateCount} client{hero.lateCount > 1 ? "s" : ""} à relancer
                </p>
                <p className="text-xs text-muted-foreground">
                  {hero.late.party} · {hero.fmt(hero.late.baseValue ?? 0)} · en retard
                </p>
              </div>
            )}
            <figcaption className="sr-only">Chiffres de l'entreprise fictive de la démo, calculés en direct.</figcaption>
          </figure>
        </div>
      </section>

      {/* Bénéfices */}
      <section id="benefices" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Pourquoi Boussole</p>
            <h2 className="mt-3 font-display text-4xl tracking-tight md:text-5xl">Rentable sur le papier, à découvert le 12 du mois ?</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Votre activité peut être rentable même si vos clients ne vous ont pas encore payé. Boussole distingue ce que vous gagnez de l'argent que vous avez réellement en banque, et vous montre quand l'un rattrape l'autre.
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-3xl border border-border bg-card p-7 shadow-soft">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 font-display text-2xl">{title}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fonctionnalités */}
      <section id="fonctionnalites" className="scroll-mt-20 border-y border-border bg-card/60">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Ce que Boussole fait pour vous</p>
            <h2 className="mt-3 font-display text-4xl tracking-tight md:text-5xl">Des chiffres fiables, expliqués simplement.</h2>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="bg-card p-7 transition-colors hover:bg-background">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 font-display text-xl">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Accès à l'application */}
      <section className="bg-[linear-gradient(to_bottom,var(--background),var(--secondary))]">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Essayez-la</p>
          <h2 className="mt-3 font-display text-4xl tracking-tight md:text-5xl">Testez avec vos propres chiffres.</h2>
          <p className="mt-4 text-muted-foreground">
            Choisissez votre devise, indiquez vos comptes, ajoutez une facture ou une dépense : la trésorerie et la rentabilité se calculent sous vos yeux. Un guide animé vous montre où saisir chaque information.
          </p>
          <a href="#app" className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-soft transition-transform hover:-translate-y-0.5">
            Ouvrir l'application <ArrowRight className="size-4" />
          </a>
        </div>
      </section>

      {/* Comment ça marche */}
      <section id="comment" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="max-w-xl font-display text-4xl tracking-tight md:text-5xl">Trois gestes, et c'est tout.</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="border-t-2 border-foreground pt-6">
                <span className="font-num text-5xl text-accent">{s.n}</span>
                <h3 className="mt-3 font-display text-2xl">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ce que Boussole fait / ne fait pas */}
      <section id="limites" className="scroll-mt-20 border-t border-border bg-card/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl tracking-tight md:text-4xl">Ce que Boussole fait</h2>
            <ul className="mt-6 space-y-3">
              {DOES.map((t) => (
                <li key={t} className="flex gap-3 leading-relaxed">
                  <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-3xl tracking-tight md:text-4xl">Ce qu'il ne remplace pas</h2>
            <ul className="mt-6 space-y-3">
              {DOES_NOT.map((t) => (
                <li key={t} className="flex gap-3 leading-relaxed text-muted-foreground">
                  <X className="mt-1 size-4 shrink-0" aria-hidden="true" /> {t}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted-foreground">
              Boussole est un outil de pilotage. Il complète votre comptabilité réglementaire, il ne s'y substitue pas.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-20">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-ink px-8 py-16 text-ink-foreground md:px-16">
          <div className="pointer-events-none absolute -bottom-32 -right-20 size-96 rounded-full bg-accent/25 blur-3xl" />
          <div className="relative max-w-2xl">
            <h2 className="font-display text-4xl tracking-tight md:text-5xl">Arrêtez de deviner. Commencez à anticiper.</h2>
            <p className="mt-4 text-lg text-ink-muted">Cinq minutes avec l'application suffisent pour voir ce qu'un tableur ne vous montre pas : le jour où l'argent manque, et pourquoi.</p>
            <a href="#app" className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-accent-foreground transition-transform hover:-translate-y-0.5">
              Ouvrir l'application <ArrowRight className="size-4" />
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-muted-foreground sm:flex-row">
          <Logo />
          <p>Chiffres de démonstration fictifs, taux de change de démonstration. Devise au choix.</p>
        </div>
      </footer>
    </div>
  );
}
