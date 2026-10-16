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
| Formation exemple (parcours TOGAF 10 complet, 9 modules, format 1.0) | `fixtures/formations/togaf10.formation.json` | Jeu de test et contenu de démonstration |
| Formation exemple (Kubernetes, 9 modules avec travaux pratiques, format 1.1) | `fixtures/formations/kubernetes-fondamentaux.formation.json` | Jeu de test de l'activité `pratique` et contenu de démonstration |
| Formation exemple courte (TOGAF 10, module 1, format 1.0) | `fixtures/formations/togaf10-m1.formation.json` | Exemple de référence de la spécification ; jeu de test rapide (parité du validateur, parcours complet dans le navigateur) |

Le format est un contrat : on ne le modifie pas pour arranger l'implémentation. Toute évolution passe par une nouvelle `formatVersion` et une mise à jour de la spécification, validée par le porteur du projet.

## Langue

Interface, messages, contenus et documentation en **français**. Code, noms de variables et commits en anglais, sauf les noms de champs du format qui restent tels que spécifiés (`activites`, `blocs`, `approfondir`…).

## Rôles

| Rôle | Droits |
|---|---|
| Collaborateur | Catalogue, sessions, demandes, parcours en ligne, « Mes demandes » |
| Manager | + valide les demandes de son équipe, demande des sessions sur mesure |
| Équipe formation | + traite les demandes, gère catalogue et sessions |
| Administrateur | + import, évaluation et publication des formations, **bascule production/démo**, paramétrage |

## Espaces : production, démonstration, évaluation

Ce sont trois **espaces de données** dans la même application, à ne pas confondre avec les environnements techniques (développement, recette, production) qui existent en plus.

| Espace | Contenu | Qui y accède | Réinitialisation |
|---|---|---|---|
| **Production** | Les vraies données : catalogue, sessions, demandes, formations publiées, progression | Tout le monde ; seul espace visible des non-administrateurs | Jamais |
| **Démonstration** | Données de test (formations, sessions, demandes fictives) pour montrer la plateforme | Administrateurs, via la bascule | Oui, à partir de `fixtures/` |
| **Évaluation** | Les formations importées, en attente de relecture et de publication | Administrateurs, depuis l'administration | **Jamais** par la réinitialisation de la démo |

- Un **bouton de bascule production/démo** n'apparaît qu'aux administrateurs. L'espace actif est toujours signalé par un bandeau de couleur différente.
- L'**évaluation** n'est pas un espace qu'on « bascule » : c'est une zone de l'administration (« Formations ») où vivent les formations importées. Elle est indépendante de la démonstration, pour qu'une réinitialisation de la démo ne puisse jamais effacer une formation en cours d'import ou de relecture.
- Isolation stricte : aucune requête ne doit pouvoir mélanger les espaces. Ici, **une base PostgreSQL par espace** (décision 3). Des tests le vérifient, dont un test qui réinitialise la démo pendant un import et vérifie que l'évaluation est intacte.
- L'espace démonstration se **réinitialise** à partir des jeux de données de `fixtures/` (action réservée aux administrateurs, journalisée).
- Les comptes utilisateurs et la progression personnelle sont propres à chaque espace (production et démonstration). L'évaluation n'a ni comptes ni progression : sa relecture dans le lecteur est un aperçu, rien n'y est enregistré.

## Formations en ligne

- Lecteur de formation qui sait afficher tous les types d'activités du format 1.1 : `lecon` (avec blocs `approfondir` repliés par défaut et références), `diaporama`, `quiz`, `ordre`, `association`, `scenario`, `fiches`, `pratique` (travaux pratiques guidés : fichiers à copier ou télécharger, étapes, auto-vérification ; la plateforme n'exécute rien). Les blocs de code ont un bouton « Copier ».
  - **Réalisation (format 1.1)** : formats 1.0 et 1.1 lus (`SUPPORTED_FORMAT_VERSIONS`), contrôles métier de `pratique` à parité avec le validateur de référence. Le TP (`src/app/learning/activities/practice.ts`) affiche objectif, prérequis, fichiers (copier, télécharger, archive `.zip` de tous les fichiers avec leur arborescence, construite dans le navigateur), étapes et résultats attendus, solution repliée, remise en état. Il est terminé quand l'apprenant a coché toute la vérification (contrôlé par l'API) ; 30 points par défaut. Chaque bloc de code rendu par le markdown reçoit un bouton « Copier » (`src/app/learning/clipboard.ts`).
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
3. Une formation valide est importée **dans l'espace d'évaluation**. Un import en cours est une opération atomique : la formation n'apparaît qu'une fois entièrement enregistrée.
4. Un administrateur la relit dans le lecteur, puis la **publie en production**. Il peut aussi la **copier dans l'espace démonstration** pour la montrer ; cette copie disparaît à la réinitialisation de la démo, pas l'original en évaluation.
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
   - Locataires du socle : `prolearning` (base `prolearning`, hôte d'API), `prolearning-demo` (base `prolearning_demo`) et `prolearning-eval` (base `prolearning_eval`), tous dans le namespace `prolearning`.
   - MinIO (fichiers déposés, images des formations) : demandé au socle dès que nécessaire, pas avant.
2. **Pile technique** : la même que les autres applications du cluster (modèle : `treasurehunters`). TypeScript de bout en bout ; **front Angular** servi par nginx ; **API Node.js (Fastify)** accessible via Kong ; PostgreSQL (`pg`, migrations SQL versionnées appliquées au démarrage sous verrou consultatif) ; validation par `zod` ; paquet `shared/` commun au front et à l'API ; Vitest ; Playwright pour les tests de bout en bout. Images sur GHCR, déploiement Argo CD.
3. **Isolation des espaces** : **une base PostgreSQL par espace** (`prolearning` pour la production, `prolearning_demo` pour la démonstration, `prolearning_eval` pour l'évaluation, ajoutée le 12 octobre 2026), donc trois locataires du socle, chacun avec son rôle. Aucune requête ne peut joindre deux bases. La publication évaluation → production et la copie évaluation → démonstration passent par l'export puis l'import au format d'échange.
4. **Validation manager** : obligatoire pour les inscriptions aux **sessions en direct** (à distance ou sur site). Aucune validation pour les **parcours en ligne en autonomie**.
5. **Visibilité des résultats** des parcours en ligne : **l'apprenant seul**. Il peut choisir de publier sa réussite et ses badges à son management ou à la communauté ; rien n'est publié sans son action.

6. **Une seule installation** du front et de l'API pour les trois espaces : l'API ouvre une connexion par base (`server/src/databases.ts`, seul module autorisé à le faire) et choisit la base à chaque requête. Un non-administrateur est toujours servi par la production.
7. **Démonstration par jeu de rôle** : dans l'espace démonstration, l'administrateur choisit un compte fictif et **joue son rôle** (collaborateur, manager, équipe formation ou administrateur) pour montrer et expliquer les fonctionnalités. Pas de mot de passe ni de compte SSO pour ces comptes fictifs ; l'en-tête indique le compte et le rôle joués. Ce jeu de rôle n'existe pas en production.
8. **Rôles gérés dans l'application (RBAC)** : Keycloak ne sert qu'à prouver l'identité (`sub`, e-mail, nom). Les rôles (collaborateur, manager, équipe formation, administrateur) et le rattachement de chaque collaborateur à son manager sont tenus dans l'application par les administrateurs. Les premiers administrateurs sont désignés par leur e-mail dans la configuration (`BOOTSTRAP_ADMIN_EMAILS`).

### Choix d'implémentation (étape 2), à confirmer par le porteur du projet

- **Évaluation** (12 octobre 2026) : import, liste, relecture, export, publication et copie en démonstration se font dans « Formations », depuis n'importe quel espace, par un administrateur (compte joué ET personne réelle). Import, publication et copie sont journalisés en **production** (`formation.import`, `formation.publish`, `formation.copy_demo`), journal permanent. La relecture utilise le lecteur en **aperçu** (`/api/evaluation/parcours`) : tout est ouvert et corrigé, rien n'est enregistré. La copie en démo peut remplacer une version déjà copiée ; la publication en production, jamais (§ 11). Une version publiée **quitte l'évaluation** (décidé le 13 octobre 2026, migration `009` pour les publications antérieures) ; les listes « Espace démonstration » et « Espace production » de la page Formations sont lues dans ces bases (`GET /api/formations/espaces`).

- **HTML brut et liens non http(s)** dans le markdown (§ 9) : signalés en **avertissement** à l'import, sans bloquer ni modifier le fichier ; le lecteur les neutralise à l'affichage. Les supprimer à l'import casserait l'aller-retour sans perte et la parité avec le validateur de référence, qui ne les refuse pas.
- **Archives `.formation.zip`** (images, PDF) : reportées jusqu'à la demande du seau MinIO au socle. Seuls les `.formation.json` s'importent pour l'instant.
- **Export** : restitue le fichier importé à l'octet près (texte conservé en base).

### Choix d'implémentation (étape 4)

- **Fiche formation** (`pl_courses`) : tenue par l'équipe formation, publiée ou en brouillon. Elle peut renvoyer à un parcours en ligne de l'espace (`formation_id`) ; le catalogue affiche alors le format « en ligne ».
- Le catalogue montre **toutes les formations** (13 octobre 2026) : un parcours en ligne de l'espace qu'aucune fiche visible ne présente y figure aussi (`parcoursSeul`), avec titre, thème et durée du parcours, et mène directement au parcours. Il compte dans « formations » et « parcours en ligne » ; il n'a ni fiche ni session, et ne se choisit pas dans une demande de session sur mesure.
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
- **Pas de notification par e-mail** pour l'instant (pas de serveur d'envoi). Le suivi se fait dans « Mes demandes », « Mon équipe » et Administration › Demandes.

### Refonte de l'interface (charte du prototype validé)

- Référence : `docs/ui/` (spécification, prototype, captures). Jetons, composants communs dans `src/app/ui/`, page interne `/administration/composants`.
- Onglets : Catalogue · Sessions · Session sur mesure (managers) · Mes demandes · Mon équipe (managers) · Mon parcours en ligne · Administration (Demandes, Formations, Comptes et rôles). Pas d'accueil : `/` ouvre le catalogue.
- La fiche formation s'ouvre en dialogue (`/catalogue/:id`) ; la gestion des sessions est à `/catalogue/:id/sessions`.
- Statuts affichés comme dans le prototype, validation manager conservée : « Envoyée · Validation manager · Décision ». Pas de liste d'attente.
- Ni `alert()` ni `confirm()` : dialogue natif et toast. La réinitialisation de la démo est dans Administration › Formations.
- Pas de script en ligne (CSP `script-src 'self'`) : CSS critique non mis en ligne au build.
- Comparaison visuelle : `npm run visual` (`playwright.visual.config.ts`, `e2e/visual/`) capture chaque écran à 1280×900 et 390×844, en clair et en sombre, et les met côte à côte avec les captures du prototype. Écarts assumés et rapport final : `docs/ui/RAPPORT-REFONTE.md`.

### Choix d'implémentation (étape 6)

- **Jeu de démonstration** : `fixtures/demo/comptes.json` (comptes fictifs), `fixtures/demo/donnees.json` (les 7 fiches et 10 sessions de l'exemple du prototype, inscriptions et demandes sur mesure avec leur historique, et la liste des formations de `fixtures/formations/` à charger : TOGAF 10 complet et Kubernetes), importées comme le ferait un administrateur.
  - Les dates des sessions sont **relatives au jour du chargement** (heure de Paris), pour que la démonstration ait toujours des sessions à venir.
- **Chargement** : au démarrage si la base démo est vide, et à chaque **réinitialisation** (Administration › Formations, administrateurs seulement).
  - La réinitialisation vide toutes les tables `pl_` de la base démo (sauf migrations et authentification), puis recharge le jeu. Elle ne touche ni l'évaluation ni la production, qui sont d'autres bases.
  - Elle est sérialisée par un verrou consultatif et journalisée en production (`demo.reset`).
  - Le compte joué redevient l'administrateur fictif par défaut.
- **Tests** : les tests de l'API ne chargent que les comptes fictifs ; les tests de bout en bout chargent le jeu complet. La réinitialisation a son propre projet Playwright (`demonstration`), exécuté après les autres.

### Choix d'implémentation (étape 7, finitions)

Décidés avec le porteur du projet le 13 octobre 2026.

- **Journal** : Administration › Journal (administrateurs) lit `pl_audit_log` de l'espace actif, du plus récent au plus ancien, par pages de 50, filtrable par famille d'actions (`GET /api/journal`). Lecture seule.
- **Thème** : clair, sombre ou celui du système, au choix dans le pied de page (« Apparence ») ; posé en `data-theme` sur la racine et mémorisé sur le poste (`localStorage`), sans compte.
- **Accessibilité** : `e2e/accessibility.spec.ts` passe axe (WCAG 2.1 A et AA) sur les écrans clés, en clair et en sombre, au bureau et à 375 px. Pour atteindre 4,5:1, `--accent` passe de #B5561A à #AA5118 et `--good` de #2F7D5B à #2E7958 (écart invisible) ; les blocs de code défilants reçoivent le focus.
- **Données personnelles** (lot 7b) : conservation par défaut, modifiable par un administrateur dans Administration › Données personnelles : demandes et historique 3 ans après clôture, journal 1 an ; comptes sans connexion depuis 1 an signalés (« Inactif ») dans Comptes et rôles, jamais supprimés automatiquement ; progression conservée tant que le compte existe.
  - Réglages dans `pl_settings` de chaque base (`server/src/privacy.ts`) ; la réinitialisation de la démo les remet par défaut. Une purge quotidienne (`main.ts`) applique à la production et à la démo leurs propres durées et la journalise (`privacy.purge`).
  - Clôture d'une demande : refusée ou annulée → dernière mise à jour ; inscription confirmée → fin de la session (la place part avec elle) ; sur mesure acceptée → dernière mise à jour.
  - Export JSON : chacun le sien (« Mes données personnelles », lien du pied de page, `GET /api/moi/donnees`), l'administrateur celui d'un compte (`GET /api/users/:id/donnees`).
  - Suppression d'un compte par un administrateur (`DELETE /api/users/:id`, jamais le sien) : compte, connexions, progression, demandes, historique et places partent. **Anonymisation** (16 octobre 2026) : son nom ou son e-mail devient « Compte supprimé » dans l'historique des demandes des autres, dans le journal (les actions restent, plus la personne) et sur les formations qu'elle a importées ou publiées, dans la base de l'espace concerné. La suppression est journalisée sans nom ni e-mail.
  - **Ouverture de la plateforme** (16 octobre 2026), réglée dans Administration › Données personnelles, par espace (`pl_settings`, clé `platform`, `GET`/`PUT /api/parametres/plateforme`) : **interne** par défaut, la suppression se demande à un administrateur ; **publique**, « Mes données personnelles » propose « Supprimer mon compte » à la place de ce message (`DELETE /api/moi`, refusé au dernier administrateur). En production, la session et la session Keycloak sont fermées ; en démonstration, le compte joué disparaît et l'administrateur reprend le compte fictif par défaut.
- **Publication des réussites** (lot 7c, décision 5) : par parcours, l'apprenant choisit privé (défaut), visible de son manager (dans « Mon équipe ») ou visible de tous (page « Réussites », lien depuis « Mon parcours en ligne »). Il peut retirer la publication à tout moment.
  - Choix sur la vue d'ensemble du parcours, possible dès qu'un module est terminé (`PUT /api/parcours/:formation/partage`) ; une ligne de `pl_achievement_shares` par parcours publié, aucune pour privé.
  - Une réussite montre le nom, le parcours, les modules terminés, le niveau et les badges ; jamais les scores ni les réponses. Le manager voit ses collaborateurs rattachés (`GET /api/equipe/reussites`), tous voient ce qui est publié pour tous (`GET /api/reussites`). Pas de classement.

## Structure du dépôt

| Dossier | Contenu |
|---|---|
| `src/` | Front Angular (composants autonomes, signaux, sans zone.js). Textes d'interface réunis dans `src/app/labels.ts`. Lecteur de formation : `src/app/learning/` (markdown, un composant par type d'activité) et `src/app/pages/learning/`. |
| `server/` | API Fastify. `src/databases.ts` ouvre une connexion par base (production, démonstration, évaluation) ; `src/migrate.ts` applique `db/migrations/` aux trois bases ; `src/context.ts` rattache chaque requête à sa session et à la base de son espace (`request.auth.db`, seul accès aux données pour le code métier, vérifié par un test). `src/format/` : validation, stockage et export ; `src/learning/` : lecteur (vue apprenant, correction, progression) ; `src/catalog/` et `src/catalog-routes.ts` : catalogue et sessions ; `src/requests/` et `src/request-routes.ts` : demandes. |
| `server/src/format/` | Format d'échange : `validate.ts` (schéma + contrôles métier, mêmes verdicts que le validateur de référence, vérifié par un test de parité ; messages en français, chemins au style du § 11), `store.ts` (règles de version du § 11, texte exact conservé pour un export sans perte). `src/formation-routes.ts` (import, liste, export, aperçu dans le lecteur) travaille dans la base d'évaluation ; `src/publication.ts` en fait sortir les formations (publication → production, copie → démonstration) par export puis import. Ce sont, avec l'infrastructure, les seuls modules autorisés à manipuler plusieurs bases. |
| `shared/` | Code commun au front et à l'API (types, règles). Imports relatifs suffixés `.js`. |
| `db/migrations/` | Scripts SQL versionnés, tables préfixées `pl_` (voir le README du dossier). |
| `e2e/` | Tests Playwright (bureau et écran de 375 px). |
| `docker/` | Images `api` (Node 24, non-root) et `web` (nginx non privilégié, relais `/api` vers Kong). |
| `fixtures/demo/` | Jeu de l'espace démonstration (comptes fictifs, catalogue, sessions, demandes), chargé par `server/src/demo.ts` au démarrage si la base démo est vide et à chaque réinitialisation, avec les formations de `fixtures/formations/` qu'il liste. |
| `docs/keycloak.md` | Déclaration du client Keycloak et configuration du SSO. |
| `deploy/` | Déploiement sur homelab-platform : valeurs du chart `app`, Application Argo CD, Ingress, `create-secrets.sh`, runbook (`deploy/README.md`). |

## Développer

Node 24 (`.nvmrc`). Trois bases PostgreSQL locales : production, démonstration, évaluation.

```bash
npm ci && npm ci --prefix server
export DATABASE_URL_PRODUCTION=postgres://…/prolearning DATABASE_URL_DEMO=postgres://…/prolearning_demo DATABASE_URL_EVALUATION=postgres://…/prolearning_eval
export AUTH_DEV_LOGIN=true BOOTSTRAP_ADMIN_EMAILS=moi@soredi.example   # connexion sans Keycloak
npm run server:dev            # API sur :5080, migrations appliquées aux trois bases
npm start                     # front sur :4200, /api relayé vers :5080
```

Vérifications (les mêmes qu'en CI) :

```bash
npm run format:check && npm test && npm run build && npm run typecheck:e2e
(cd server && npm run typecheck && npm test)   # TEST_DATABASE_URL_PRODUCTION / _DEMO / _EVALUATION
npm run e2e                   # E2E_DATABASE_URL_PRODUCTION / _DEMO / _EVALUATION ; PLAYWRIGHT_CHROMIUM_PATH facultatif
npm run visual                # comparaison avec docs/ui/captures/ → visual-report/index.html (hors CI)
npm run valider -- fixtures/formations/kubernetes-fondamentaux.formation.json   # et les autres formations exemples
```

## Ordre de réalisation proposé pour le pilote

1. Socle : projet, base de données, authentification, rôles, espaces production, démonstration et évaluation, avec la bascule et le bandeau.
2. Format : modèle de données des formations, import dans l'espace d'évaluation (validation + rapport), publication, export, tests d'aller-retour avec la formation exemple.
3. Lecteur de formation : tous les types d'activités, progression, déblocage, points.
4. Catalogue et sessions : fiches formation, sessions à distance et sur site, places restantes.
5. Demandes : inscription, session sur mesure, « Mes demandes », traitement par l'équipe formation.
6. Démonstration : jeux de données de `fixtures/`, réinitialisation.
7. Finitions : accessibilité, mobile, thèmes, journalisation.

## Définition de « terminé »

- Tests automatisés verts, dont : validation du format (cas valides et invalides), aller-retour import/export, isolation des trois espaces (réinitialiser la démo ne touche ni l'évaluation ni la production), parcours complet de la formation exemple dans le navigateur.
- Aucun texte d'interface en anglais.
- Parcours clé utilisable au clavier et sur un écran de 375 px de large.
