import { ArrowLeft } from "lucide-react";
import { DemoApp } from "@/components/finance/DemoApp";
import { Logo } from "@/components/finance/Logo";

/** L'application seule, en plein écran, séparée de la page de présentation. */
export function AppPage() {
  return (
    <div className="min-h-screen bg-secondary/40">
      <header className="border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 sm:px-5">
          <Logo href="#" />
          <a href="#" className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
            <ArrowLeft className="size-4" /> Présentation
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-2 py-3 sm:px-5 sm:py-6">
        <DemoApp />
      </main>
    </div>
  );
}
