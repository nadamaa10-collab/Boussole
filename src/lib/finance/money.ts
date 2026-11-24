/**
 * Devises et arrondis monétaires.
 * Aucune devise n'est imposée : la liste sert à la recherche, le choix revient à l'utilisateur.
 */
export type CurrencyCode = string; // code ISO 4217, ex. "EUR"

export interface CurrencyInfo {
  code: CurrencyCode;
  name: string;
  symbol: string;
  decimals: number;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: "EUR", name: "Euro", symbol: "€", decimals: 2 },
  { code: "USD", name: "Dollar américain", symbol: "$", decimals: 2 },
  { code: "MAD", name: "Dirham marocain", symbol: "DH", decimals: 2 },
  { code: "GBP", name: "Livre sterling", symbol: "£", decimals: 2 },
  { code: "CHF", name: "Franc suisse", symbol: "CHF", decimals: 2 },
  { code: "CAD", name: "Dollar canadien", symbol: "$CA", decimals: 2 },
  { code: "XOF", name: "Franc CFA (BCEAO)", symbol: "F CFA", decimals: 0 },
  { code: "XAF", name: "Franc CFA (BEAC)", symbol: "FCFA", decimals: 0 },
  { code: "TND", name: "Dinar tunisien", symbol: "DT", decimals: 3 },
  { code: "DZD", name: "Dinar algérien", symbol: "DA", decimals: 2 },
  { code: "AED", name: "Dirham des Émirats", symbol: "AED", decimals: 2 },
  { code: "SAR", name: "Riyal saoudien", symbol: "SAR", decimals: 2 },
  { code: "JPY", name: "Yen japonais", symbol: "¥", decimals: 0 },
  { code: "CNY", name: "Yuan chinois", symbol: "¥", decimals: 2 },
  { code: "INR", name: "Roupie indienne", symbol: "₹", decimals: 2 },
  { code: "AUD", name: "Dollar australien", symbol: "$AU", decimals: 2 },
  { code: "BRL", name: "Réal brésilien", symbol: "R$", decimals: 2 },
  { code: "MXN", name: "Peso mexicain", symbol: "$MX", decimals: 2 },
  { code: "SEK", name: "Couronne suédoise", symbol: "kr", decimals: 2 },
  { code: "NOK", name: "Couronne norvégienne", symbol: "kr", decimals: 2 },
  { code: "DKK", name: "Couronne danoise", symbol: "kr", decimals: 2 },
  { code: "PLN", name: "Złoty polonais", symbol: "zł", decimals: 2 },
];

export function currencyInfo(code: CurrencyCode): CurrencyInfo | undefined {
  return CURRENCIES.find((c) => c.code === code);
}

export function currencyDecimals(code: CurrencyCode): number {
  return currencyInfo(code)?.decimals ?? 2;
}

/** Recherche par code ISO, nom ou symbole (insensible aux accents et à la casse). */
export function searchCurrencies(query: string): CurrencyInfo[] {
  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const q = norm(query.trim());
  if (!q) return CURRENCIES;
  return CURRENCIES.filter((c) => norm(c.code).includes(q) || norm(c.name).includes(q) || norm(c.symbol).includes(q));
}

/** Arrondi « au demi le plus éloigné de zéro » aux décimales de la devise. */
export function roundMoney(value: number, currency: CurrencyCode): number {
  const f = 10 ** currencyDecimals(currency);
  const r = (Math.sign(value) * Math.round(Math.abs(value) * f + 1e-9)) / f;
  return Object.is(r, -0) ? 0 : r;
}

/** Somme exacte en unités mineures (évite 0,1 + 0,2 = 0,30000000000000004). */
export function sumMoney(values: number[], currency: CurrencyCode): number {
  const f = 10 ** currencyDecimals(currency);
  const total = values.reduce((acc, v) => acc + Math.round(v * f), 0);
  return roundMoney(total / f, currency);
}

/** Tolérance d'un demi-centime (ou équivalent) pour les comparaisons. */
export function moneyEpsilon(currency: CurrencyCode): number {
  return 0.5 / 10 ** currencyDecimals(currency);
}

export function formatMoney(value: number, currency: CurrencyCode, locale = "fr-FR"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: currencyDecimals(currency),
    maximumFractionDigits: currencyDecimals(currency),
  }).format(value);
}
