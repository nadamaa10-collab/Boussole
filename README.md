# Boussole

Le pilotage financier des freelances, indépendants et petites entreprises : argent disponible, trésorerie jour par jour, factures à encaisser et rentabilité réelle, dans la devise de votre choix.

- `src/lib/finance/` : moteur de calcul (fonctions pures, sans interface).
- `src/lib/finance/__tests__/` : les 21 scénarios obligatoires et des contrôles complémentaires.
- `src/pages/Landing.tsx` : page d'accueil.
- `src/components/finance/DemoApp.tsx` et `src/components/demo/` : la démo interactive.

Application indépendante (Vite + React + Tailwind), sans Lovable. Le dossier `dist/` produit par `npm run build` se met en ligne sur n'importe quel hébergeur de sites statiques.
- `docs/AUDIT-ET-PLAN.md` : audit et plan de refonte.

```bash
npm install
npm run dev     # démo en local sur http://localhost:5173
npm run build   # version à mettre en ligne (dossier dist/)
npm test        # lance les tests du moteur
npm run typecheck
```
