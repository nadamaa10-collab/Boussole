export function Logo({ className = "" }: { className?: string }) {
  return (
    <a href="#" className={`inline-flex items-center gap-2 font-display text-xl tracking-tight ${className}`} aria-label="Boussole, accueil">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
        <circle cx="16" cy="16" r="15" className="fill-primary" />
        <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeOpacity=".25" className="text-primary-foreground" />
        <path d="M16 5l4.2 11L16 27l-4.2-11z" className="fill-accent" />
        <path d="M16 16l4.2 0L16 27z" fill="#000" fillOpacity=".18" />
      </svg>
      Boussole
    </a>
  );
}
