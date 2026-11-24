# Boussole

Le pilotage financier des freelances, indépendants et petites entreprises : argent disponible, trésorerie jour par jour, factures à encaisser et rentabilité réelle, dans la devise de votre choix.

- `src/lib/finance/` : moteur de calcul (fonctions pures, sans interface).
- `src/lib/finance/__tests__/` : les 21 scénarios obligatoires et des contrôles complémentaires.
- `src/routes/index.tsx` : page d'accueil (projet Lovable / TanStack Start).
- `docs/AUDIT-ET-PLAN.md` : audit et plan de refonte.

```bash
npm install
npm test        # lance les tests du moteur
npm run typecheck
```
