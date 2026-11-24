# Boussole : audit et plan de refonte

> **Mise à jour :** Boussole ne dépend plus de Lovable. La démo a été reconstruite comme une application indépendante (Vite + React), branchée sur le moteur ci-dessous. Les sections 4 et 5 sont remplacées par la feuille de route de la démo en fin de document.

## 1. Ce qui a été audité

Je n'ai reçu qu'un seul fichier de l'application Lovable : la page d'accueil `src/routes/index.tsx`. Les fichiers suivants **n'ont pas été transmis**, donc ils n'ont pas pu être audités :

- `src/components/finance/DemoApp.tsx`, avec ses calculs, ses onglets, sa saisie et son état ;
- `src/components/finance/Logo.tsx` ;
- les styles (`paper-grain`, `bg-ink`, `font-num`, etc.) et la configuration Tailwind.

Les points ci-dessous sur la démo sont donc **déduits des textes de la page d'accueil**, pas vérifiés dans son code.

## 2. Constats

| Sujet | Constat | Gravité |
|---|---|---|
| Devise | « Dhs » est écrit en dur (aperçu, pied de page « Montants en dirhams »). | Bloquant pour un public international |
| Aperçu du hero | Les chiffres (1 015, 680, 1 575) sont saisis à la main, sans lien avec la démo. | Contraire à l'exigence « montrer les fonctionnalités réelles » |
| « Après règlements » | 1 015 + 680 = 1 695, pas 1 575. Le montant mélange encaissements et paiements sans chronologie. | Calcul trompeur |
| Trésorerie | Promesse « ce qu'il restera une fois tout réglé » : c'est un solde final, pas une prévision jour par jour. | À remplacer (Phase 1) |
| Résultat | « Ce qui reste vraiment pour vous » sans prélèvements configurés : le libellé est inexact. | À corriger |
| « Mois que vous tenez sans vente » | Méthode non affichée ; les mois vides risquent d'être comptés comme zéro. | À corriger |
| Positionnement | Bon ton et identité visuelle à conserver. Il manque ce que Boussole ne remplace pas. | Amélioration |

## 3. Ce qui a été fait (sur la branche `claude/github-link-correction-9hdmlj`)

### Phase 1 : fiabilité financière (moteur de calcul livré et testé)

Le moteur `src/lib/finance/` est fait de fonctions pures, sans interface, réutilisables par `DemoApp` et par la future application.

| Exigence | Fichier | Testé |
|---|---|---|
| Trésorerie chronologique jour par jour, minimum, premier jour négatif, alerte rédigée | `forecast.ts` | ✅ (exemple du cahier des charges reproduit à l'identique) |
| Scénario standard / prudent, retards simulés, dépense exceptionnelle, variation de CA, taux de change de simulation | `forecast.ts` | ✅ |
| Statut de règlement + statut d'échéance + libellé combiné | `invoices.ts` | ✅ |
| Paiements partiels, trop-perçus contrôlés, remboursements, doublons | `invoices.ts` | ✅ |
| Solde = solde initial + mouvements **postérieurs** à sa date (pas de double comptage) | `cash.ts` | ✅ |
| Flux réels : exploitation / investissement / financement, transferts neutres | `cash.ts` | ✅ |
| Rentabilité séparée de la trésorerie, prorata des prestations sur plusieurs mois, amortissements, intérêts d'emprunt, écarts de change | `profitability.ts` | ✅ |
| Prélèvements seulement s'ils sont configurés, avec leur source ; sinon « Résultat estimé avant prélèvements » | `profitability.ts` | ✅ |
| Devise principale libre, taux jamais inventés, montants d'origine conservés | `money.ts`, `fx.ts` | ✅ |
| Changement de devise principale : aperçu, confirmation, historique des taux | `base-currency.ts` | ✅ |
| CA moyen sans compter les mois vides comme zéro ; autonomie (2 métriques) ; CA minimum avec hypothèses affichées | `indicators.ts` | ✅ |
| Actions prioritaires classées par urgence puis par montant | `indicators.ts` | ⚠️ codé, pas encore testé unitairement |
| Récurrences, modification ponctuelle d'une occurrence | `recurrence.ts` | ✅ |
| Démo cohérente : paiement partiel, retard, facture en USD, récurrences, achat exceptionnel, découvert temporaire malgré un mois rentable, taux de démo marqués comme fictifs | `demo-data.ts` | ✅ |

Les 21 cas de test exigés, plus 10 contrôles complémentaires, sont dans `src/lib/finance/__tests__/scenarios.test.ts`. Résultat : `npm test` donne **31/31 réussis**.

### Page d'accueil

`src/routes/index.tsx` a été réécrit :

- la devise n'est plus imposée ;
- l'aperçu est **calculé par le moteur** sur la démo ;
- les trois bénéfices du positionnement sont présentés ;
- une section « Ce que Boussole fait / ne remplace pas » a été ajoutée ;
- les libellés sont exacts.

Elle n'a pas encore été vérifiée dans le projet Lovable (voir la section 5).

## 4. Reste à faire

### Phase 1 : brancher le moteur

1. Remplacer les calculs internes de `DemoApp` par `@/lib/finance`.
2. Ajouter à la démo un sélecteur de devise (`previewBaseCurrencyChange` puis `applyBaseCurrencyChange`).

### Phase 2 : expérience quotidienne

1. Écran d'accueil en 5 blocs, dans l'ordre :
   1. argent disponible ;
   2. ce qui m'attend (7 / 30 / 90 jours) ;
   3. actions prioritaires ;
   4. rentabilité du mois ;
   5. tendances.
2. Bouton flottant « + Ajouter » avec 5 choix et des formulaires courts. Les champs avancés sont repliés.
3. Journal avec filtres, recherche, duplication et export CSV.
4. Écran des récurrences et écran des budgets (seuils réglables, engagé / payé).
5. Navigation mobile en barre du bas.
6. États vides explicites. Aide contextuelle (infobulles avec le terme technique).

### Phase 3 : pilotage avancé

- Simulateur de scénarios dans l'interface (le moteur les gère déjà).
- Import CSV avec rapprochement des doublons.
- Justificatifs, rapports.
- Source de taux de change externe, en affichant la source et la date.
- Historique des modifications (journal d'audit).

### Données et migration

- Le schéma cible est `src/lib/finance/types.ts`.
- Une migration est nécessaire si l'application actuelle stocke des données. Les montants existants seront considérés dans la devise saisie par l'utilisateur à la première ouverture : on la lui demande, sans jamais la déduire. Les opérations « payées » deviennent une facture + un paiement à la même date.
- Pour cette migration, il me faut le code de stockage actuel.

## 5. Pour continuer, j'ai besoin de

1. **Tout le projet Lovable.** Dans Lovable, menu GitHub puis « Connect to GitHub » : Lovable pousse le projet complet dans un dépôt. Donnez-moi ensuite le nom de ce dépôt (ou copiez son contenu dans `nadamaa10-collab/Boussole`).
2. **Une confirmation** que l'application ne stocke aujourd'hui aucune donnée d'utilisateur réel (démo seule), ou l'emplacement de ce stockage.

## 6. Démo indépendante (livrée)

La démo couvre :
- **Accueil** en 4 blocs : argent disponible, ce qui m'attend, à faire en priorité, ce que l'activité gagne.
- **Trésorerie** : graphique jour par jour (7 / 30 / 90 jours / personnalisé), scénarios standard et prudent, simulations (retard client, dépense exceptionnelle, nouveau contrat, baisse des encaissements, taux de change).
- **Factures** : paiements partiels, modification de l'échéance et de la fiabilité.
- **Rentabilité** : mois par mois, avec les repères de dirigeant.
- **Budgets** (seuils réglables), **Récurrences** (confirmation, modification ponctuelle) et **Journal** (recherche, filtres, export CSV).
- Bouton « + Ajouter » avec 5 opérations, choix de la devise de pilotage, navigation mobile en barre du bas.

Prochaines étapes, après tes retours sur la démo :
1. ajuster textes, chiffres et parcours ;
2. compte utilisateur et sauvegarde des données (plateforme réelle) ;
3. import CSV bancaire, justificatifs, source officielle de taux de change.
