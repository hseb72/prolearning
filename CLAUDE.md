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
- Réalisation (étape 3) :
  - Les **réponses ne quittent jamais l'API** : la vue apprenant (`server/src/learning/view.ts`) retire bonnes réponses, solutions et arbre des cas pratiques. Les éléments à ordonner ou associer portent des clés opaques et sont mélangés de façon déterministe. La correction se fait côté API (`grading.ts`), et un cas pratique est rejoué par l'API à chaque choix.
  - Le quiz tire ses questions côté API et enregistre la tentative (`pl_quiz_attempts`) ; une tentative ne se corrige qu'une fois.
  - On garde le **meilleur** résultat par activité (`pl_activity_results`). Un module est terminé quand toutes ses activités obligatoires sont faites et ses quiz réussis ; il rapporte un bonus de 50 points, une seule fois (`pl_module_completions`).
  - Niveaux et badges sont calculés, non stockés (`shared/gamification.ts`) : Découverte, Initié (100), Praticien (300), Confirmé (600), Expert (1000) ; badges Premier pas, Module accompli, Sans faute, Stratège, Parcours terminé.
  - Markdown rendu avec `marked`, HTML brut supprimé, liens `http(s)` seulement (`src/app/learning/markdown.ts`).

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

## Décisions de démarrage

Prises avec le porteur du projet le 11 octobre 2026. Toute remise en cause passe par lui.

1. **Hébergement** : cible définitive sur le cluster décrit dans [`hseb72/homelab-platform`](https://github.com/hseb72/homelab-platform), en suivant le **pattern `shared`** de [`hseb72/platform-patterns`](https://github.com/hseb72/platform-patterns) (chart `app` publié en OCI, version épinglée). L'application est un **locataire** du socle : PostgreSQL, MinIO et Kong mutualisés, ressources déclarées côté socle (issue « Nouveau locataire »), secrets créés hors Git. Le protocole à suivre est `homelab-platform/CONSUMING.md` ; le déploiement de `hseb72/treasurehunters` (`deploy/`) sert de modèle, y compris pour les écarts connus entre le chart `app` 0.4.0 et le socle (`HTTPRoute` et provisionnement du chart désactivés, Ingress `kong` et `nginx` en manifestes locaux).
   - Front : `prolearning.crealcs.com`. API : `api.prolearning.crealcs.com`, exposée via Kong ; le front relaie `/api` vers Kong (même origine, pas de CORS).
   - SSO : Keycloak de Soredi, émetteur OIDC `https://sso.crealcs.com/realms/soredi`, client `pro-learning`. Le secret du client est fourni par le porteur du projet et créé hors Git (`deploy/create-secrets.sh`).
   - Administrateurs d'amorçage : `sebastien.raimondi@soredi-group.com` et `sebastien.raimondi@gmail.com`.
   - Locataires du socle : `prolearning` (base `prolearning`, hôte d'API) et `prolearning-demo` (base `prolearning_demo`), tous deux dans le namespace `prolearning`.
   - MinIO (fichiers déposés, images des formations) : demandé au socle dès que nécessaire, pas avant.
2. **Pile technique** : la même que les autres applications du cluster (modèle : `treasurehunters`). TypeScript de bout en bout ; **front Angular** servi par nginx ; **API Node.js (Fastify)** accessible via Kong ; PostgreSQL (`pg`, migrations SQL versionnées appliquées au démarrage sous verrou consultatif) ; validation par `zod` ; paquet `shared/` commun au front et à l'API ; Vitest ; Playwright pour les tests de bout en bout. Images sur GHCR, déploiement Argo CD.
3. **Isolation des espaces** : **une base PostgreSQL par espace** (`prolearning` pour la production, `prolearning_demo` pour la démonstration), donc deux locataires du socle, chacun avec son rôle. Aucune requête ne peut joindre les deux bases. La publication démo → production passe par l'export puis l'import au format d'échange.
4. **Validation manager** : obligatoire pour les inscriptions aux **sessions en direct** (à distance ou sur site). Aucune validation pour les **parcours en ligne en autonomie**.
5. **Visibilité des résultats** des parcours en ligne : **l'apprenant seul**. Il peut choisir de publier sa réussite et ses badges à son management ou à la communauté ; rien n'est publié sans son action.

6. **Une seule installation** du front et de l'API pour les deux espaces : l'API ouvre une connexion par base (`server/src/databases.ts`, seul module autorisé à le faire) et choisit la base à chaque requête. Un non-administrateur est toujours servi par la production.
7. **Démonstration par jeu de rôle** : dans l'espace démonstration, l'administrateur choisit un compte fictif et **joue son rôle** (collaborateur, manager, équipe formation ou administrateur) pour montrer et expliquer les fonctionnalités. Pas de mot de passe ni de compte SSO pour ces comptes fictifs ; le bandeau de démonstration indique le rôle joué. Ce jeu de rôle n'existe pas en production.
8. **Rôles gérés dans l'application (RBAC)** : Keycloak ne sert qu'à prouver l'identité (`sub`, e-mail, nom). Les rôles (collaborateur, manager, équipe formation, administrateur) et le rattachement de chaque collaborateur à son manager sont tenus dans l'application par les administrateurs. Les premiers administrateurs sont désignés par leur e-mail dans la configuration (`BOOTSTRAP_ADMIN_EMAILS`).

### Choix d'implémentation (étape 2), à confirmer par le porteur du projet

- **HTML brut et liens non http(s)** dans le markdown (§ 9) : signalés en **avertissement** à l'import, sans bloquer ni modifier le fichier ; le lecteur les neutralise à l'affichage. Les supprimer à l'import casserait l'aller-retour sans perte et la parité avec le validateur de référence, qui ne les refuse pas.
- **Archives `.formation.zip`** (images, PDF) : reportées jusqu'à la demande du seau MinIO au socle. Seuls les `.formation.json` s'importent pour l'instant.
- **Export** : restitue le fichier importé à l'octet près (texte conservé en base).

### Choix d'implémentation (étape 4)

- **Fiche formation** (`pl_courses`) : tenue par l'équipe formation, publiée ou en brouillon. Elle peut renvoyer à un parcours en ligne de l'espace (`formation_id`) ; le catalogue affiche alors le format « en ligne ».
- **Sessions** (`pl_course_sessions`) : à distance ou sur site. On les **annule** au lieu de les supprimer. Les collaborateurs ne voient que les sessions à venir et non annulées ; l'équipe formation voit tout.
- **Places restantes** = capacité − inscriptions confirmées (`pl_session_registrations`, alimentée par les demandes de l'étape 5). La capacité ne descend pas sous les places prises.
- Dates saisies et affichées à l'**heure de Paris**, quel que soit le poste (`src/app/catalog/dates.ts`).
- Création, modification et annulation sont journalisées (`course.*`, `session.*`).

### Choix d'implémentation (étape 5)

- **Inscription à une session en direct** : le collaborateur demande depuis la fiche, son **manager actuel** valide ou refuse, puis l'équipe formation confirme ou refuse.
  - La confirmation prend une place sous verrou : pas de surréservation.
  - Un compte sans manager rattaché ne peut pas demander ; le message l'invite à faire faire le rattachement par un administrateur.
  - Le demandeur peut retirer sa demande, ou se désinscrire avant le début de la session.
  - Annuler une session clôt ses demandes en cours et libère les places.
- **Session sur mesure** : demandée par un manager (avec ou sans fiche du catalogue). L'équipe formation la prend en charge, puis l'accepte ou la refuse avec une réponse.
- **Historique** de chaque demande (`pl_request_events`) : statut, auteur, date, commentaire. Il est visible du demandeur, de son manager et de l'équipe formation.
- **Visibilité** : chacun voit ses propres demandes ; un manager voit celles des collaborateurs qui lui sont rattachés ; l'équipe formation voit la file à traiter.
- **Pas de notification par e-mail** pour l'instant (pas de serveur d'envoi). Le suivi se fait dans « Mes demandes », « Mon équipe » et « Demandes à traiter ».

## Structure du dépôt

| Dossier | Contenu |
|---|---|
| `src/` | Front Angular (composants autonomes, signaux, sans zone.js). Textes d'interface réunis dans `src/app/labels.ts`. Lecteur de formation : `src/app/learning/` (markdown, un composant par type d'activité) et `src/app/pages/learning/`. |
| `server/` | API Fastify. `src/databases.ts` ouvre une connexion par espace ; `src/migrate.ts` applique `db/migrations/` aux deux bases ; `src/context.ts` rattache chaque requête à sa session et à la base de son espace (`request.auth.db`, seul accès aux données pour le code métier, vérifié par un test). `src/format/` : validation, stockage et export ; `src/learning/` : lecteur (vue apprenant, correction, progression) ; `src/catalog/` et `src/catalog-routes.ts` : catalogue et sessions ; `src/requests/` et `src/request-routes.ts` : demandes. |
| `server/src/format/` | Format d'échange : `validate.ts` (schéma + contrôles métier, mêmes verdicts que le validateur de référence, vérifié par un test de parité ; messages en français, chemins au style du § 11), `store.ts` (règles de version du § 11, texte exact conservé pour un export sans perte). `src/publication.ts` est le seul module métier qui touche les deux bases (publication démo → production par export puis import). |
| `shared/` | Code commun au front et à l'API (types, règles). Imports relatifs suffixés `.js`. |
| `db/migrations/` | Scripts SQL versionnés, tables préfixées `pl_` (voir le README du dossier). |
| `e2e/` | Tests Playwright (bureau et écran de 375 px). |
| `docker/` | Images `api` (Node 24, non-root) et `web` (nginx non privilégié, relais `/api` vers Kong). |
| `fixtures/demo/` | Comptes fictifs de l'espace démonstration, chargés au démarrage si la base démo est vide. |
| `docs/keycloak.md` | Déclaration du client Keycloak et configuration du SSO. |
| `deploy/` | Déploiement sur homelab-platform : valeurs du chart `app`, Application Argo CD, Ingress, `create-secrets.sh`, runbook (`deploy/README.md`). |

## Développer

Node 24 (`.nvmrc`). Deux bases PostgreSQL locales, une par espace.

```bash
npm ci && npm ci --prefix server
export DATABASE_URL_PRODUCTION=postgres://…/prolearning DATABASE_URL_DEMO=postgres://…/prolearning_demo
export AUTH_DEV_LOGIN=true BOOTSTRAP_ADMIN_EMAILS=moi@soredi.example   # connexion sans Keycloak
npm run server:dev            # API sur :5080, migrations appliquées aux deux bases
npm start                     # front sur :4200, /api relayé vers :5080
```

Vérifications (les mêmes qu'en CI) :

```bash
npm run format:check && npm test && npm run build && npm run typecheck:e2e
(cd server && npm run typecheck && npm test)   # TEST_DATABASE_URL_PRODUCTION / TEST_DATABASE_URL_DEMO
npm run e2e                   # E2E_DATABASE_URL_PRODUCTION / E2E_DATABASE_URL_DEMO ; PLAYWRIGHT_CHROMIUM_PATH facultatif
npm run valider -- fixtures/formations/togaf10-m1.formation.json
```

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
