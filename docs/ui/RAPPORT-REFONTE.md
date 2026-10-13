# Refonte de l'interface : rapport final

Comparaison de l'application avec le prototype validé, capture par capture. Les captures de
l'application (`docs/ui/rapport/`) sont produites par `npm run visual` dans l'espace
démonstration, avec le jeu de `fixtures/` (voir « Refaire la comparaison » en fin de page).

## Écarts communs à tous les écrans

| Écart | Raison |
|---|---|
| En-tête : compte joué, bascule production/démo et déconnexion à la place de « Mode démonstration » | Décision I. Le prototype, hors ligne, n'a ni comptes ni espaces. |
| Onglets selon le rôle joué : « Mon équipe » pour un manager, « Administration » pour l'équipe formation et les administrateurs | Décision F. Le prototype montre tous les onglets à un seul utilisateur fictif. |
| Bandeau : textes de la plateforme (« Espace démonstration · données de test… ») | Décision J. |
| Pied de page : « Portail formation interne · Une question ? L'équipe formation vous répond. » | Les mentions « Prototype de cadrage » et « Données d'exemple » ne valent que pour le prototype. |
| Apostrophes typographiques (’) dans les textes de l'interface | Typographie française ; les contenus des formations restent tels que fournis. |
| Dates des sessions décalées de quelques jours | Dates relatives au jour du chargement de la démonstration, pour qu'il y ait toujours des sessions à venir. |
| Ordre des fiches du catalogue : par thème | Ordre fourni par l'API (logique métier inchangée). |
| Places restantes : réelles (inscriptions confirmées), pas les taux de remplissage fictifs du prototype | Données. |
| Orange des textes #AA5118 et vert « En ligne » #2E7958 au lieu de #B5561A et #2F7D5B | RGAA AA : les couleurs du prototype donnaient 4,47:1 et 4,32:1, sous le minimum de 4,5:1 (audit axe, étape 7). |
| Navigation « Activité précédente / Activité suivante » en bas de chaque activité | Ajout de la plateforme : navigation au clavier et sur mobile sans revenir à la liste. |

## Écran par écran

Chaque section montre la capture de référence à gauche, l'application à droite.

### 01 · Catalogue

| Prototype | Application |
|---|---|
| ![](captures/01-catalogue.png) | ![](rapport/bureau-clair/01-catalogue.png) |
| ![](captures/01-catalogue-sombre.png) | ![](rapport/bureau-sombre/01-catalogue.png) |
| ![](captures/01-catalogue-mobile.png) | ![](rapport/mobile-clair/01-catalogue.png) |

Corrigé : ordre des pastilles (en ligne, à distance, sur site), largeur du filtre de thème.
Restant : durées des fiches selon le jeu de démonstration (« 3 jours (21 h) »).

### 02 · Fiche formation (dialogue)

| Prototype | Application |
|---|---|
| ![](captures/02-catalogue-fiche.png) | ![](rapport/bureau-clair/02-catalogue-fiche.png) |

Corrigé : anneau de focus autour du dialogue, espacements sous le titre.
Restant : résumé de la fiche affiché sous les pastilles (champ de la fiche) ; pas de
« Liste d'attente » (décision C).

### 03 · Sessions

| Prototype | Application |
|---|---|
| ![](captures/03-sessions.png) | ![](rapport/bureau-clair/03-sessions.png) |
| ![](captures/03-sessions-sombre.png) | ![](rapport/bureau-sombre/03-sessions.png) |
| ![](captures/03-sessions-mobile.png) | ![](rapport/mobile-clair/03-sessions.png) |

Corrigé : abréviation du mois avec son point (« NOV. »).
Restant : « Demande envoyée » sur les sessions déjà demandées par le compte joué ; une session
complète affiche « Complet » et non « Liste d'attente » (décision C) ; texte d'introduction qui
mentionne la validation du manager.

### 04 · Demande d'inscription (dialogue)

| Prototype | Application |
|---|---|
| ![](captures/04-dialog-inscription.png) | ![](rapport/bureau-clair/04-dialog-inscription.png) |

Restant : pas de case « J'ai informé mon manager » (décision E) ; une phrase explique la
validation par le manager.

### 05 · Session sur mesure

| Prototype | Application |
|---|---|
| ![](captures/05-session-sur-mesure.png) | ![](rapport/bureau-clair/05-session-sur-mesure.png) |

Restant : champs de la plateforme (décision D) : sujet, période en texte libre, sans niveau, lieu
ni dates.

### 06 · Mes demandes

| Prototype | Application |
|---|---|
| ![](captures/06-mes-demandes.png) | ![](rapport/bureau-clair/06-mes-demandes.png) |
| ![](captures/06-mes-demandes-avec-toast.png) | ![](rapport/bureau-clair/06-mes-demandes-avec-toast.png) |

Corrigé : alignement de la pastille de statut, espace sous le titre.
Restant : étape « Validation manager » pour les inscriptions (décision C) ; historique
dépliable sous chaque demande.

### 07 · Administration › Demandes

| Prototype | Application |
|---|---|
| ![](captures/07-admin-demandes.png) | ![](rapport/bureau-clair/07-admin-demandes.png) |

Restant : rubriques Demandes / Formations / Comptes et rôles sur des pages distinctes
(décision F) ; champ « Réponse au demandeur » et bouton « Confirmer l'inscription » de la
plateforme ; compteur « Refusées » au lieu de « Liste d'attente » (décision C).

### 08 · Import refusé

| Prototype | Application |
|---|---|
| ![](captures/08-admin-import-erreurs.png) | ![](rapport/bureau-clair/08-admin-import-erreurs.png) |

Corrigé : espace entre la zone de dépôt et le rapport.
Restant : messages du validateur de la plateforme (même verdict que le validateur de
référence) ; seuls les `.formation.json` s'importent (les archives `.formation.zip` attendent
le stockage MinIO) ; liste « Espace production » en plus.

### 09 · Import valide, formations en évaluation

| Prototype | Application |
|---|---|
| ![](captures/09a-admin-import-valide.png) | ![](rapport/bureau-clair/09a-admin-import-valide.png) |
| ![](captures/09b-admin-formations-evaluation.png) | ![](rapport/bureau-clair/09b-admin-formations-evaluation.png) |

Restant : actions de la plateforme (Relire, Exporter, Copier en démonstration, Publier en
production) ; pas de « Retirer » : une version importée reste en évaluation (§ 11 du format).

### 10 · Vue d'ensemble d'un parcours (TOGAF 10)

| Prototype | Application |
|---|---|
| ![](captures/10-parcours-carte.png) | ![](rapport/bureau-clair/10-parcours-carte.png) |
| ![](captures/10-parcours-carte-mobile.png) | ![](rapport/mobile-clair/10-parcours-carte.png) |

Corrigé : niveau et badges au-dessus des modules, bouton « Commencer : module 1 ».
Restant : une seule page sert les captures 10 et 19 (fil d'Ariane, version et compteurs en
tête) ; niveaux et badges de la plateforme (décision B) ; ni « Mission Atelia », ni « Tout
débloquer », ni remise à zéro (décision H) ; section « À propos de ce parcours ».

### 11 · Lecteur : leçon et « Approfondir »

| Prototype | Application |
|---|---|
| ![](captures/11-lecteur-lecon-approfondir.png) | ![](rapport/bureau-clair/11-lecteur-lecon.png) |
| ![](captures/11-lecteur-lecon-sombre.png) | ![](rapport/bureau-sombre/11-lecteur-lecon.png) |
| ![](captures/11-lecteur-lecon-mobile.png) | ![](rapport/mobile-clair/11-lecteur-lecon.png) |

Corrigé : hauteur des lignes de tableau, « (facultatif) ».
Restant : la colonne des activités reste visible pendant le défilement (même comportement,
position différente selon la hauteur de la capture).

### 12 · Association vérifiée

| Prototype | Application |
|---|---|
| ![](captures/12-lecteur-association-verifiee.png) | ![](rapport/bureau-clair/12-lecteur-association-verifiee.png) |

Restant : la correction vient de l'API, avec la réponse attendue sous chaque ligne fausse et
l'explication de la formation.

### 13 et 14 · Mise en situation

| Prototype | Application |
|---|---|
| ![](captures/13-lecteur-scenario-choix.png) | ![](rapport/bureau-clair/13-lecteur-scenario-choix.png) |
| ![](captures/14-lecteur-scenario-bilan.png) | ![](rapport/bureau-clair/14-lecteur-scenario-bilan.png) |

Restant : le choix et son retour restent neutres (ni rouge ni vert) : l'API rejoue le cas
pratique sans dire au navigateur si un choix est bon, pour que les réponses ne quittent pas
l'API. Le bilan indique les étoiles et les points ; « Rejouer le cas pratique » ; la suite par
la navigation du bas.

### 15 · Fiches de révision

| Prototype | Application |
|---|---|
| ![](captures/15-lecteur-fiches.png) | ![](rapport/bureau-clair/15-lecteur-fiches.png) |

Restant : « J'ai lu, continuer » marque les fiches comme vues puis passe à la suite.

### 16 et 17 · Quiz

| Prototype | Application |
|---|---|
| ![](captures/16-lecteur-quiz-question.png) | ![](rapport/bureau-clair/16-lecteur-quiz-question.png) |
| ![](captures/17-lecteur-quiz-resultat.png) | ![](rapport/bureau-clair/17-lecteur-quiz-resultat.png) |

Corrigé : bouton « Retenter ».
Restant : correction à la fin du quiz et non après chaque question (décision A) ; la question
montre les réponses cochées, le résultat reprend la correction de chaque question.

### 18 · Ordre vérifié

| Prototype | Application |
|---|---|
| ![](captures/18-lecteur-ordre-verifie.png) | ![](rapport/bureau-clair/18-lecteur-ordre-verifie.png) |

Restant : capturé dans l'aperçu de l'évaluation, car le module 3 est verrouillé pour un compte
de démonstration neuf (bandeau d'aperçu et onglet Administration actif) ; ordre de départ
mélangé par l'API.

### 19 · Vue d'ensemble d'un parcours (Kubernetes)

| Prototype | Application |
|---|---|
| ![](captures/19-formation-vue-ensemble.png) | ![](rapport/bureau-clair/19-formation-vue-ensemble.png) |

Restant : voir 10 (une seule page pour les deux captures).

### 20 · Travaux pratiques

| Prototype | Application |
|---|---|
| ![](captures/20-lecteur-travaux-pratiques.png) | ![](rapport/bureau-clair/20-lecteur-travaux-pratiques.png) |

### 21 · Leçon avec encadrés

| Prototype | Application |
|---|---|
| ![](captures/21-lecteur-lecon-code.png) | ![](rapport/bureau-clair/21-lecteur-lecon-code.png) |

### 22 et 23 · Bandeaux

| Prototype | Application |
|---|---|
| ![](captures/22-bandeau-production.png) | ![](rapport/bureau-clair/22-bandeau-production.png) |
| ![](captures/23-bandeau-demo.png) | ![](rapport/bureau-clair/23-bandeau-demo.png) |

Restant : la production de test est vide (base des tests) ; bouton « Nouvelle fiche » visible
de l'équipe formation.

## Refaire la comparaison

```bash
export E2E_DATABASE_URL_PRODUCTION=… E2E_DATABASE_URL_DEMO=… E2E_DATABASE_URL_EVALUATION=…
npm run visual        # visual-report/index.html : toutes les variantes, côte à côte
```

Le script (`playwright.visual.config.ts`, `e2e/visual/`) remet les bases de test à zéro,
réinitialise la démonstration au début de chaque variante, puis capture chaque écran à
1280×900 et 390×844, en clair et en sombre, polices chargées. Les écarts assumés de chaque
écran sont déclarés dans `e2e/visual/scenarios.ts` et repris dans le rapport HTML.
