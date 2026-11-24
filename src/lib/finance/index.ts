/**
 * Moteur financier de Boussole — fonctions pures, sans état ni effet de bord.
 * Trois dimensions reliées mais jamais confondues :
 *  - trésorerie (cash.ts, forecast.ts) : l'argent réellement disponible, aujourd'hui et demain ;
 *  - rentabilité (profitability.ts) : ce que l'activité gagne, indépendamment des paiements ;
 *  - engagements (invoices.ts, indicators.ts) : ce qu'on me doit et ce que je dois.
 */
export * from "./dates";
export * from "./money";
export * from "./types";
export * from "./fx";
export * from "./invoices";
export * from "./recurrence";
export * from "./cash";
export * from "./forecast";
export * from "./profitability";
export * from "./indicators";
export * from "./base-currency";
export * from "./demo-data";
export * from "./setup";
export * from "./levies";
export * from "./categories";
