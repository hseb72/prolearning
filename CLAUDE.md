# Portail de formation 3S - Pro Learning

Ce fichier donne à Claude Code le contexte du projet. Il est lu au début de chaque session : garde-le à jour quand une décision change.

## En une phrase

Une plateforme interne de formation : catalogue, sessions à distance et sur site, demandes d'inscription et de sessions sur mesure, et parcours en ligne en autonomie, ludiques, importés depuis un format d'échange partagé.

## Documents de référence

| Document | Où | Rôle |
|---|---|---|
| Page de cadrage | lien fourni par le porteur du projet (document Claude) | Objectifs, rôles, priorités, risques, décisions |
| Prototype cliquable | lien fourni par le porteur du projet | Référence d'ergonomie et de parcours, **pas** de code à reprendre |
| Format d'échange des formations | `docs/format/format-formation-3s.md` | **Contrat** entre l'atelier de production de contenus et la plateforme |
| Schéma JSON du format | `docs/format/formation.schema.json` | Validation à l'import |
| Validateur de référence | `tools/valider-formation.js` | Schéma + contrôles métier ; la plateforme doit donner les mêmes verdicts |
| Formation exemple | `fixtures/formations/togaf10-m1.formation.json` | Jeu de test et contenu de démonstration |

Le format est un contrat : on ne le modifie pas pour arranger l'implémentation. Toute évolution passe par une nouvelle `formatVersion` et une mise à jour de la spécification, validée par le porteur du projet.

## Langue

Interface, messages, contenus et documentation en **français**. Code, noms de variables et commits en anglais, sauf les noms de champs du format qui restent tels que spécifiés (`activites`, `blocs`, `approfondir`…).

## Rôles

| Rôle | Droits |
|---|---|
| Collaborateur | Catalogue, sessions, demandes, parcours en ligne, « Mes demandes » |
| Manager | + valide les demandes de son équipe, demande des sessions sur mesure |
| Équipe formation | + traite les demandes, gère catalogue et sessions |
| Administrateur | + import/publication des formations, **bascule production/démo**, paramétrage |

## Espaces production et démonstration

Ce sont deux **espaces de données** dans la même application, à ne pas confondre avec les environnements techniques (développement, recette, production) qui existent en plus.

- **Production** : les vraies données. C'est le seul espace visible des non-administrateurs.
- **Démonstration** : des données de test (formations, sessions, demandes fictives), pour montrer la plateforme et relire une formation importée avant de la publier.
- Un **bouton de bascule production/démo** n'apparaît qu'aux administrateurs. L'espace actif est toujours signalé par un bandeau de couleur différente.
- Isolation stricte : aucune requête ne doit pouvoir mélanger les deux espaces. Chaque table métier porte l'espace, ou bien chaque espace a son propre schéma de base, au choix de l'architecture retenue. Des tests le vérifient.
- L'espace démonstration se **réinitialise** à partir des jeux de données de `fixtures/` (action réservée aux administrateurs).
- Les comptes utilisateurs et la progression personnelle sont propres à chaque espace.

## Formations en ligne

- Lecteur de formation qui sait afficher tous les types d'activités du format 1.0 : `lecon` (avec blocs `approfondir` repliés par défaut et références), `diaporama`, `quiz`, `ordre`, `association`, `scenario`, `fiches`.
- Progression enregistrée par `formation.id` + `module.id` + `activite.id`, conservée d'une version de formation à l'autre tant que les identifiants ne changent pas.
- Déblocage séquentiel des modules et seuil de réussite des quiz, comme décrit dans le format.
- Ludification : points d'expérience par défaut (§ 10 du format), niveaux, badges communs. Rester sobre ; pas de classement nominatif entre collègues sans décision RH.
- Références : afficher le type d'accès (libre, inscription, payant) à côté de chaque lien.

## Import et export des formations

1. L'administrateur dépose un `.formation.json` ou un `.formation.zip`.
2. La plateforme valide (schéma + contrôles métier, mêmes règles que `tools/valider-formation.js`) et affiche un rapport lisible, avec le chemin de chaque erreur.
3. Une formation valide est importée **dans l'espace démonstration**.
4. Un administrateur la relit dans le lecteur, puis la **publie en production**.
5. Règles de version : voir § 11 du format. Tout import et toute publication sont journalisés (qui, quand, quelle version).
6. Export : toute formation se réexporte au même format, sans perte (test d'aller-retour obligatoire).

Sécurité de l'import : markdown sans HTML brut et nettoyé, SVG nettoyés, liens `http(s)` uniquement, tailles maximales du § 1.

## Exigences transverses

- Accessibilité : RGAA / WCAG 2.1 AA (clavier, lecteur d'écran, contrastes). Chaque exercice interactif a une alternative clavier (ex. boutons haut/bas pour l'activité `ordre`).
- Mobile : le lecteur de formation est pleinement utilisable sur téléphone.
- Données personnelles : minimisation, durées de conservation paramétrables, export et suppression des données d'un utilisateur.
- Connexion : prévoir le SSO d'entreprise (OIDC) ; une connexion locale suffit pour le pilote si le SSO n'est pas prêt.
- Marque : identité 3S - Pro Learning (bleu nuit #14213D, orange #E07A2E / #B5561A, fond #F7F5F0 ; titres Source Serif 4, texte IBM Plex Sans), thèmes clair et sombre.

## Décisions à prendre au démarrage (à confirmer avec le porteur du projet)

1. **Hébergement** : interne, ou cloud (dans l'Union européenne).
2. **Pile technique.** Proposition par défaut si rien n'est imposé : TypeScript de bout en bout, Next.js, PostgreSQL, Prisma, Auth.js (OIDC), Vitest et Playwright pour les tests.
3. **Isolation des espaces** : colonne `space` sur chaque table, ou schéma PostgreSQL par espace.
4. **Validation manager** obligatoire ou simple information (règle RH).
5. **Visibilité des résultats** des parcours en ligne (apprenant seul, manager, RH).

Ne pas trancher ces points seul : poser la question, puis consigner la réponse ici.

## Ordre de réalisation proposé pour le pilote

1. Socle : projet, base de données, authentification, rôles, espaces production/démo avec la bascule et le bandeau.
2. Format : modèle de données des formations, import (validation + rapport), export, tests d'aller-retour avec la formation exemple.
3. Lecteur de formation : tous les types d'activités, progression, déblocage, points.
4. Catalogue et sessions : fiches formation, sessions à distance et sur site, places restantes.
5. Demandes : inscription, session sur mesure, « Mes demandes », traitement par l'équipe formation.
6. Démonstration : jeux de données de `fixtures/`, réinitialisation.
7. Finitions : accessibilité, mobile, thèmes, journalisation.

## Définition de « terminé »

- Tests automatisés verts, dont : validation du format (cas valides et invalides), aller-retour import/export, isolation des espaces, parcours complet de la formation exemple dans le navigateur.
- Aucun texte d'interface en anglais.
- Parcours clé utilisable au clavier et sur un écran de 375 px de large.
