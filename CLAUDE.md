# Boussole : mémoire du projet

Ce fichier est lu automatiquement au début de chaque session Claude Code sur ce dépôt.
Il résume les décisions prises jusqu'ici. Mettez-le à jour quand une décision change.

## La personne et sa façon de travailler

- Fondatrice non technicienne, francophone, basée au Maroc. Elle travaille surtout sur **iPad** (Safari).
- Répondre **en français**, simplement, sans jargon. Expliquer quoi faire sur son écran, étape par étape.
- Elle teste réellement l'application et remonte des retours précis : les traiter un par un et dire ce qui a été vérifié.
- Ne jamais inventer un chiffre, un taux légal ou un taux de change. Signaler ce qui n'a pas pu être vérifié.

## Le produit

Boussole est un outil de **pilotage financier** pour freelances, indépendants et TPE.
Ce n'est pas un logiciel de comptabilité. La question à laquelle il répond chaque matin :
« Voilà ce que j'ai, ce qui va entrer, ce qui va sortir, ce que mon activité gagne et ce que je dois surveiller. »

Le cahier des charges complet (le « prompt Lovable ») est résumé dans `docs/AUDIT-ET-PLAN.md`.
Le projet a quitté Lovable : c'est maintenant une application indépendante.

### Principes non négociables (vérifiés par les tests)

- Trois dimensions **séparées** : trésorerie (argent réellement en banque), rentabilité (ce qui est gagné, payé ou non), engagements (à recevoir, à payer).
- **Aucune devise imposée.** La devise principale est choisie par l'utilisateur, indépendamment du pays. Les montants gardent leur devise d'origine.
- **Aucun taux de change inventé.** Taux saisi par l'utilisateur, ou taux de démonstration marqué « fictif ». Un montant sans taux est signalé, jamais additionné en silence.
- Le **solde de départ** d'un compte est celui **du matin** de sa date : il inclut tout jusqu'à la veille. Les paiements antérieurs ne sont jamais recomptés.
- Trésorerie **chronologique**, jour par jour. Le **point le plus bas part du solde réel du matin** : il ne peut pas dépasser l'argent disponible.
- Une charge récurrente n'est déduite qu'une fois **confirmée** (« Oui, c'est fait »).
- Impôts et cotisations : seulement s'ils sont configurés (taux + source), payés mensuellement, trimestriellement ou annuellement. Sinon : « Résultat estimé avant prélèvements ».
- Catégorie **obligatoire** pour les dépenses (elle alimente les budgets), choisie dans un menu avec « Nouvelle catégorie… ».

## Architecture

- Vite + React 18 + TypeScript + Tailwind 3. Aucune dépendance serveur.
- `src/lib/finance/` : **moteur de calcul**, fonctions pures (factures, paiements, trésorerie, prévisions, rentabilité, devises, impôts, budgets, indicateurs).
- `src/lib/finance/__tests__/` : 43 tests, dont les 21 scénarios du cahier des charges et le **cas d'école Studio Nour** (`cas-ecole.test.ts`).
- `src/pages/Landing.tsx` : page de présentation. `src/pages/AppPage.tsx` : l'application en plein écran.
- `src/main.tsx` : deux pages par le hash. Par défaut la présentation, `#app` l'application.
- `src/components/demo/` : l'interface de l'application (onglets, formulaires, guide animé `Tour.tsx`).
- `src/components/demo/persist.ts` : sauvegarde. D'abord sur le compte Claude de la personne (capacité `db` de l'artefact, document privé `data/users/<id>/boussole`), sinon `localStorage`. Les brouillons de formulaires sont aussi sauvegardés.
- Migration des données enregistrées : `migrateData` dans `src/lib/finance/setup.ts` (champ `version`).

### Commandes

```bash
npm install
npm test           # tests du moteur (doivent tous passer)
npm run typecheck
npm run build      # produit dist/
npx vite preview   # sert dist/ en local, pour tester avec Playwright
```

Avant de publier : `npm test`, `npm run typecheck`, `npm run build`, puis rejouer le parcours concerné dans un vrai navigateur (Playwright est préinstallé). Tester aussi en format iPhone et iPad.

## Où vit la version en ligne aujourd'hui

- **Application de démo** (artefact Claude, privé) : https://claude.ai/artifact/MT4GsrAse23yAK4TFay2Wa
  - Accès direct à l'application : ajouter `#app`.
  - Slug de l'artefact : `a59a20f4-87f0-4077-9f2c-aa997694e867`. Capacités déclarées : `db` et `user`.
  - Publier : `npm run build`, copier `dist/` dans le scratchpad, puis `publish_files` sur ce slug, en mode `replace`, avec `base_version` = version en ligne (`get_artifact`).
  - **Ses vraies données sont dans cet artefact** (document `data/users/<son id>/boussole`). Ne jamais les effacer. Elles sont lisibles avec `db_get` pour diagnostiquer un écart.
- **Cas d'école « Studio Nour »** (document Claude Docs) : https://claude.ai/artifact/KFYLKgityMBmE38JV19QwH
  - 25 opérations en 8 étapes, avec les montants attendus. Toute modification du moteur qui change ces montants doit mettre à jour **le test `cas-ecole.test.ts` et ce document**.

## Stratégie et prochaines étapes (décidées le 25 novembre 2026)

Plan de lancement de la fondatrice, sur LinkedIn :
1. Construire sa légitimité : retours d'expérience, contenus éducatifs sur le lancement de projet.
2. Dans quelques semaines : partager Boussole comme « l'outil que j'ai développé pour gérer mes finances ».
3. Ensuite : le proposer au public, avec une **offre gratuite comme produit d'appel**.

Décisions :
- D'ici le partage, elle utilise la démo actuelle avec ses vrais chiffres. Les captures d'écran se font avec l'exemple fictif.
- Pour le partage public, il faut des **comptes Boussole** : connexion par e-mail ou Google, données synchronisées sur tous les appareils. Choix retenu : **Supabase** (pas de serveur à gérer ; règles d'accès pour que chacun ne voie que ses données). Il faut prévoir 2 à 3 semaines avant le post.
- La création d'un compte gratuit sert de capture d'e-mails. Plus tard : une version gratuite limitée et une version payante.
- Hébergement du site : Cloudflare Pages ou Netlify, avec son propre nom de domaine. Éviter l'offre gratuite de Vercel (usage commercial interdit) et GitHub Pages (pas prévu pour un service commercial).
- À prévoir : **import de ses données actuelles** depuis la démo, politique de confidentialité, export des données utilisateur, déclaration CNDP (loi 09-08, à faire vérifier par un professionnel).
- Paiements : Stripe n'accepte pas les entreprises basées au Maroc (à revérifier). Pistes : Paddle, Lemon Squeezy, CMI.

Pas encore fait (retours ou idées notés) :
- Taux de change du jour automatique : impossible dans l'artefact (accès réseau bloqué). Possible une fois sur son propre site, avec la source affichée.
- Import de relevé bancaire CSV.
- Comptes Supabase, nom de domaine, mise en ligne publique.

## Dépôts GitHub

- `nadamaa10-collab/Boussole` : ce projet. Branche par défaut actuelle : `claude/github-link-correction-9hdmlj`.
- `menurestaurantscan/menu` : un autre projet de la fondatrice (menus de restaurants), sans lien avec Boussole.
