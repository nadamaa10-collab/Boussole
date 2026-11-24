import type { ISODate } from "./dates";
import type { CurrencyCode } from "./money";

/** Taux de change : 1 `from` = `rate` `to`, valable à `date`, avec sa provenance. */
export interface FxRate {
  from: CurrencyCode;
  to: CurrencyCode;
  rate: number;
  date: ISODate;
  /** ex. "Saisie manuelle", "BCE", "Taux de démonstration (fictifs)" */
  source: string;
  demo?: boolean;
}

/** Prélèvement fiscal ou social configuré par l'utilisateur (jamais deviné par l'application). */
export interface Levy {
  label: string;
  /** 0,22 = 22 % */
  rate: number;
  base: "chiffre_affaires" | "resultat";
  validFrom: ISODate;
  /** Référence permettant de vérifier le taux (texte officiel, expert-comptable…) */
  source: string;
  /** Rythme de paiement (par défaut : trimestriel). */
  frequency?: "mensuelle" | "trimestrielle" | "annuelle";
  /** Jour du mois qui suit la période où le paiement est dû (par défaut : dernier jour). */
  dueDay?: number;
}

export interface Settings {
  companyName: string;
  /** Pays et devise sont indépendants : la devise n'est jamais déduite du pays. */
  country?: string;
  baseCurrency: CurrencyCode;
  locale: string;
  legalStatus?: string;
  taxRegime?: string;
  vatRegistered: boolean;
  /** 1 = janvier */
  fiscalYearStartMonth: number;
  levies: Levy[];
  budgetThresholds: { warning: number; over: number };
  /** Mois passés confirmés « sans activité » (AAAA-MM). */
  inactiveMonths: string[];
  /** Mois passés que l'utilisateur sait incomplets (AAAA-MM). */
  incompleteMonths: string[];
  targetMonthlyPay?: number;
  /** Part des charges variables dans le CA, hypothèse saisie par l'utilisateur (0,15 = 15 %). */
  variableCostRate?: number;
  cashReserveTarget?: number;
  monthlyRevenueTarget?: number;
  /** Catégories ajoutées par l'utilisateur. */
  customCategories?: { depense: string[]; recette: string[] };
  /** Trace des changements de devise principale. */
  baseCurrencyHistory?: { from: CurrencyCode; to: CurrencyCode; date: ISODate; referenceDate: ISODate }[];
}

export interface Account {
  id: string;
  name: string;
  kind: "banque" | "especes";
  currency: CurrencyCode;
  /** Solde constaté à `openingDate`, qui inclut tous les mouvements jusqu'à cette date incluse. */
  openingBalance: number;
  openingDate: ISODate;
  source: "manuel" | "import";
}

export type Confidence = "confirme" | "probable" | "incertain";

export interface EconomicRate {
  /** 1 unité de la devise de la facture = `rate` unités de la devise principale */
  rate: number;
  date: ISODate;
  source: string;
  base: CurrencyCode;
}

export interface Invoice {
  id: string;
  kind: "client" | "fournisseur";
  party: string;
  reference?: string;
  description: string;
  category: string;
  /** immobilisation = achat amorti sur sa durée d'utilisation */
  nature: "exploitation" | "immobilisation";
  /** Durée d'amortissement, pour les immobilisations. */
  usefulLifeMonths?: number;
  currency: CurrencyCode;
  amountHT: number;
  vatAmount: number;
  /** Date économique (émission / réalisation). */
  issueDate: ISODate;
  /** Échéance contractuelle. */
  dueDate: ISODate;
  /** Date de paiement estimée, si elle diffère de l'échéance. */
  expectedPaymentDate?: ISODate;
  confidence?: Confidence;
  /** Prestation étalée sur plusieurs mois : le revenu est réparti au prorata des jours. */
  servicePeriod?: { start: ISODate; end: ISODate };
  /** Taux figé à l'émission pour la rentabilité. Jamais modifié par l'encaissement. */
  economicRate?: EconomicRate;
  economicRateHistory?: EconomicRate[];
  cancelled?: boolean;
  project?: string;
  attachment?: string;
  notes?: string;
}

export interface Payment {
  id: string;
  invoiceId?: string;
  recurrenceId?: string;
  occurrenceDate?: ISODate;
  accountId: string;
  /** Date effective du mouvement en banque. */
  date: ISODate;
  /** Montant réellement débité/crédité, dans la devise du compte. Négatif = remboursement. */
  amount: number;
  /** Montant soldé dans la devise de la facture (= amount si même devise). */
  settledAmount?: number;
  /** Frais bancaires, dans la devise du compte. */
  fees?: number;
  note?: string;
}

export type MovementType =
  | "apport" // apport personnel : ni chiffre d'affaires, ni charge
  | "retrait" // prélèvement de l'entrepreneur : ni charge, ni CA
  | "emprunt" // déblocage d'un prêt : entrée d'argent, pas un revenu
  | "remboursement_emprunt" // capital (hors résultat) + intérêts (charge)
  | "transfert" // entre deux comptes : neutre
  | "frais_bancaires"
  | "prelevement"; // paiement d'impôts ou de cotisations : sortie d'argent, déjà estimée à part dans le résultat

export interface Movement {
  id: string;
  type: MovementType;
  date: ISODate;
  accountId: string;
  /** Montant positif, dans la devise du compte. */
  amount: number;
  /** Transfert : compte crédité et montant réellement reçu (dans sa devise). */
  toAccountId?: string;
  toAmount?: number;
  /** Remboursement d'emprunt : part d'intérêts incluse dans `amount`. */
  interestPart?: number;
  /** Paiement d'impôts ou de cotisations : prélèvement concerné et période payée (ex. « 2026-T4 »). */
  levyLabel?: string;
  period?: string;
  description?: string;
}

export type Frequency = "hebdomadaire" | "mensuelle" | "trimestrielle" | "annuelle";

export interface Recurrence {
  id: string;
  kind: "depense" | "recette";
  label: string;
  category: string;
  /** financement = ex. échéance d'emprunt, hors charges d'exploitation */
  nature: "exploitation" | "financement";
  amount: number;
  currency: CurrencyCode;
  frequency: Frequency;
  startDate: ISODate;
  endDate?: ISODate;
  accountId: string;
  /** Charge incompressible (loyer, assurance…) : sert au calcul d'autonomie. */
  essential: boolean;
  /** Modification ponctuelle d'une occurrence, sans toucher à la série. */
  overrides?: Record<ISODate, { amount?: number; date?: ISODate; skip?: boolean }>;
}

export interface Budget {
  category: string;
  /** Montants dans la devise principale. */
  monthly?: number;
  annual?: number;
}

export interface FinanceData {
  settings: Settings;
  accounts: Account[];
  invoices: Invoice[];
  payments: Payment[];
  movements: Movement[];
  recurrences: Recurrence[];
  rates: FxRate[];
  budgets: Budget[];
  /** true = jeu de démonstration, à signaler dans l'interface. */
  demo?: boolean;
  /** Version du format des données enregistrées (pour les migrations). */
  version?: number;
}
