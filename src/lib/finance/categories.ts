import type { FinanceData } from "./types";

export type CategoryKind = "depense" | "recette";

export const DEFAULT_CATEGORIES: Record<CategoryKind, string[]> = {
  depense: [
    "Loyer",
    "Logiciels",
    "Internet et téléphone",
    "Assurance",
    "Fournitures",
    "Matériel",
    "Sous-traitance",
    "Déplacements",
    "Honoraires",
    "Marketing et publicité",
    "Formation",
    "Repas",
    "Frais bancaires",
    "Divers",
  ],
  recette: ["Prestations", "Ventes", "Conseil", "Formation", "Abonnements clients", "Divers"],
};

/** Catégories proposées : par défaut, personnalisées, puis celles déjà utilisées. */
export function categoriesFor(data: FinanceData, kind: CategoryKind): string[] {
  const used =
    kind === "depense"
      ? [
          ...data.invoices.filter((i) => i.kind === "fournisseur").map((i) => i.category),
          ...data.recurrences.filter((r) => r.kind === "depense").map((r) => r.category),
          ...data.budgets.map((b) => b.category),
        ]
      : [...data.invoices.filter((i) => i.kind === "client").map((i) => i.category), ...data.recurrences.filter((r) => r.kind === "recette").map((r) => r.category)];
  const all = [...DEFAULT_CATEGORIES[kind], ...(data.settings.customCategories?.[kind] ?? []), ...used].map((c) => c.trim()).filter(Boolean);
  const seen = new Set<string>();
  return all.filter((c) => {
    const k = c.toLocaleLowerCase("fr");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
