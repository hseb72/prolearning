Objectif de cette tâche : refondre l'interface de l'application pour qu'elle soit **identique au prototype validé**, écran par écran, en thème clair et sombre, sur ordinateur et sur mobile. L'interface actuelle est jugée trop austère ; le prototype est la cible, pas une inspiration.

## Références (lis-les entièrement avant de proposer quoi que ce soit)

Tout est dans `docs/ui/` :
1. `docs/ui/SPEC-UI.md` — la spécification : jetons de couleur (clair et sombre), typographie, rayons, composants, écrans, responsive, accessibilité, libellés.
2. `docs/ui/prototype/portail-formation.html` — le prototype complet et autonome. **Il fait foi** pour tout détail absent de la spécification. Ouvre-le avec Playwright (il fonctionne hors ligne en mode démonstration) et inspecte les styles calculés quand tu as un doute.
3. `docs/ui/prototype/prototype.css` — sa feuille de style, valeurs exactes.
4. `docs/ui/captures/*.png` — 31 captures de référence (1280 px, 390 px, thème sombre). Regarde-les toutes.

## Règles

- **Ne touche pas à la logique métier**, aux API, au modèle de données, au format d'échange ni aux tests fonctionnels existants. Cette tâche ne change que la présentation (styles, composants d'affichage, mise en page, libellés).
- **Garde la pile technique actuelle.** N'ajoute pas de bibliothèque de composants (pas de Material, Bootstrap, shadcn, etc.). Si le projet utilise Tailwind, déclare les jetons de `SPEC-UI.md` § 2 dans sa configuration et supprime les couleurs par défaut utilisées aujourd'hui ; sinon, crée une feuille de jetons en variables CSS reprenant exactement celles du prototype (`--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--accent`, `--accent-fill`, `--on-accent`, `--navy`, `--on-navy`, `--navy-accent`, `--good`, `--good-bg`, `--bad`, `--bad-bg`, `--warn`, `--warn-bg`, `--info`, `--info-bg`, `--chip`), avec le bloc sombre sous `prefers-color-scheme: dark` et `[data-theme="dark"]`.
- **Valeurs exactes** : couleurs, tailles de police, graisses, interlignes, rayons, paddings, gaps, points de rupture tels qu'écrits dans la spécification ou mesurés sur le prototype. Pas d'arrondi « au plus proche » d'une échelle de framework.
- **Polices auto-hébergées** : Source Serif 4 (400–700), IBM Plex Sans (400, 500, 600), JetBrains Mono (400, 600) via les paquets `@fontsource/*`, sous-ensemble latin. Aucun appel à Google Fonts.
- **Libellés français identiques** au prototype (onglets, boutons, statuts, bandeaux, messages vides, toasts). Aucun texte d'interface en anglais.
- **Composants réutilisables**, un par élément du § 4 de la spécification (bouton, pastille, statut, carte, stat, filtre, dialogue, toast, encadré, Approfondir, référence, option de quiz, ligne de session, tuile de module, anneau de progression, bloc de code avec « Copier », étape de TP…). Pas de styles dupliqués écran par écran.
- **Pas de `alert()`, `confirm()` ni `prompt()`** : dialogues et toasts comme dans le prototype.
- **Accessibilité** au moins égale au prototype (SPEC-UI § 8).
- Les écrans qui n'existent pas dans le prototype (connexion, erreurs, pages 404, éventuels écrans ajoutés depuis) suivent la même charte : en-tête, colonne de 1080 px, sur-titre + titre sérif + introduction, cartes.

## Méthode attendue

1. **Inventaire, avant de coder.** Liste les écrans et composants actuels de l'application et mets chacun en face de son équivalent dans le prototype et de sa capture. Signale tout écran de l'application sans équivalent et tout écran du prototype non encore implémenté. Présente-moi ce tableau et ton plan, puis attends mon accord.
2. **Fondations** : jetons, polices, styles de base (corps, titres, liens, focus), en-tête avec onglets, bandeau d'espace, bascule production/démo pour les administrateurs, pied de page.
3. **Bibliothèque de composants** (§ 4), avec une page interne de démonstration de tous les composants et de leurs états, dans les deux thèmes, accessible aux seuls administrateurs ou en développement.
4. **Écrans**, dans cet ordre : Catalogue (et fiche), Sessions (et demande d'inscription), Session sur mesure, Mes demandes, Administration (demandes, import et rapport, listes Évaluation / Démonstration / Production), Mon parcours, vue d'ensemble d'une formation, Lecteur (leçon, Approfondir, références, quiz, ordre, association, mise en situation, fiches, travaux pratiques, blocs de code).
5. **Comparaison visuelle systématique.** Écris un script Playwright qui capture chaque écran de l'application dans les mêmes états que les captures de référence (mêmes données d'exemple : utilise les formations de `fixtures/formations/` dans l'espace démonstration), à 1280×900 et 390×844, en clair et en sombre, polices chargées (`document.fonts.ready`). Compare-les aux captures de `docs/ui/captures/` côte à côte, corrige les écarts, recommence. Garde ce script dans le dépôt pour éviter les régressions.
6. **Rapport final** : pour chaque capture de référence, la capture de l'application à côté et la liste des écarts restants, chacun justifié (contrainte technique, donnée différente) ou corrigé.

## Critères d'acceptation

- Côte à côte, chaque écran de l'application est indiscernable de sa capture de référence, à la donnée près : mêmes couleurs, polices, tailles, espacements, rayons, états (actif, désactivé, coché, juste, faux, verrouillé, terminé).
- Thème sombre complet, sans couleur codée en dur qui casserait le contraste.
- Aucun débordement horizontal à 375 px de large, hormis les zones prévues pour défiler (onglets, sommaire mobile, tableaux, code).
- Navigation complète au clavier, focus visible partout, `prefers-reduced-motion` respecté.
- Tous les tests existants passent ; la logique n'a pas changé.

Commence par l'étape 1 et ne code rien avant mon accord sur l'inventaire et le plan.
