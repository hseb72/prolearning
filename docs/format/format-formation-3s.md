# Format d'échange des formations 3S — version 1.0

Spécification du format qui permet de produire une formation en ligne en dehors de la plateforme (par exemple avec Claude), puis de l'importer dans la plateforme 3S - Pro Learning sans développement.

- Fichier de validation : `formation.schema.json` (JSON Schema, draft 2020-12).
- Exemple de référence : `togaf10-m1.formation.json` (module 1 du parcours TOGAF 10, complet).

Ce document fait foi pour la plateforme comme pour les auteurs. Toute évolution passe par un changement de `formatVersion` (voir « Versions du format »).

---

## 1. Le paquet

Une formation s'échange sous l'une de deux formes :

| Forme | Quand l'utiliser | Contenu |
|---|---|---|
| Fichier `*.formation.json` | Formation sans image ni fichier joint | Le JSON seul |
| Archive `*.formation.zip` | Formation avec images, PDF ou diapositives | `formation.json` à la racine + dossier `assets/` |

Règles de l'archive :

- `formation.json` est obligatoirement à la racine de l'archive.
- Les fichiers joints sont dans `assets/` (sous-dossiers autorisés) et sont référencés par leur chemin relatif, par exemple `assets/m1/domaines.png`.
- Types acceptés : `png`, `jpg`, `jpeg`, `webp`, `svg`, `pdf`. Les SVG sont nettoyés à l'import (scripts et liens externes supprimés).
- Taille maximale : 10 Mo par fichier, 200 Mo par archive.
- Tout fichier de `assets/` non référencé est signalé à l'import (avertissement, pas d'erreur).
- Tout chemin référencé mais absent de l'archive bloque l'import.

Encodage UTF-8, sans BOM.

---

## 2. Vue d'ensemble

```
Formation
├── métadonnées (titre, public, objectifs, durée, révision, droits…)
├── progression (déblocage, seuil de réussite)
├── références[]      ← bibliographie de la formation, citée par identifiant
├── glossaire[]
└── modules[]
    └── activités[]   ← dans l'ordre où l'apprenant les suit
        ├── lecon        : contenu rédigé, avec blocs « Approfondir » à la demande
        ├── diaporama    : diapositives commentées (image + explication)
        ├── quiz         : questions à choix, avec explication et seuil
        ├── ordre        : remettre des éléments dans l'ordre
        ├── association  : relier des paires
        ├── scenario     : cas à embranchements, noté en étoiles
        └── fiches       : cartes recto/verso pour réviser
```

---

## 3. Formation (racine)

| Champ | Type | Oblig. | Description |
|---|---|---|---|
| `format` | `"3s-formation"` | oui | Identifie le format. |
| `formatVersion` | `"1.0"` | oui | Version du format (ce document). |
| `id` | slug | oui | Identifiant stable de la formation, identique d'une version à l'autre. Minuscules, chiffres, tirets. |
| `version` | semver | oui | Version du contenu, par exemple `1.2.0`. |
| `langue` | code BCP 47 | oui | `fr`, `en`, `fr-CA`… |
| `titre` | texte | oui | |
| `sousTitre` | texte | non | |
| `theme` | texte | oui | Thème du catalogue (ex. « Architecture et SI »). |
| `resume` | markdown | oui | Présentation affichée sur la fiche catalogue. |
| `public` | texte | oui | |
| `prerequis` | texte | oui | « Aucun » si aucun. |
| `objectifs` | texte[] | oui | Objectifs pédagogiques de la formation. |
| `dureeEstimeeMinutes` | entier | oui | Durée totale estimée du parcours en ligne. |
| `niveau` | `debutant` \| `intermediaire` \| `avance` | non | |
| `motsCles` | texte[] | non | Pour la recherche. |
| `auteurs` | `{nom, role}`[] | oui | |
| `dateRevision` | date ISO | oui | Date de la dernière révision du contenu. |
| `prochaineRevision` | date ISO | non | La plateforme alerte les administrateurs à l'échéance. |
| `droits` | markdown | oui | Mentions : marques citées, sources, licence d'usage. |
| `progression` | objet | oui | Voir § 4. |
| `references` | Référence[] | non | Voir § 7. |
| `glossaire` | Terme[] | non | Voir § 8. |
| `modules` | Module[] | oui | Au moins un. |

---

## 4. Progression

```json
"progression": { "deblocage": "sequentiel", "seuilReussite": 0.75 }
```

- `deblocage` : `sequentiel` (un module s'ouvre quand le précédent est terminé) ou `libre`.
- `seuilReussite` : part de bonnes réponses exigée aux quiz, entre 0 et 1. Un quiz peut le redéfinir.
- Un module est **terminé** quand toutes ses activités obligatoires sont faites et que ses quiz obligatoires sont réussis.

Les points d'expérience, niveaux et badges sont gérés par la plateforme (§ 10). Le format peut seulement ajuster les points d'une activité (`points`).

---

## 5. Module

| Champ | Type | Oblig. | Description |
|---|---|---|---|
| `id` | slug | oui | Unique dans la formation et **stable entre versions** : la progression des apprenants y est rattachée. |
| `titre` | texte | oui | |
| `resume` | markdown | oui | |
| `objectifs` | texte[] | oui | « À la fin de ce module, vous saurez… » |
| `dureeEstimeeMinutes` | entier | oui | |
| `activites` | Activité[] | oui | Au moins une. |

---

## 6. Activités

Champs communs à toutes les activités :

| Champ | Type | Oblig. | Description |
|---|---|---|---|
| `id` | slug | oui | Unique dans le module, stable entre versions. |
| `type` | voir ci-dessous | oui | |
| `titre` | texte | oui | |
| `obligatoire` | booléen | non | `true` par défaut. |
| `dureeEstimeeMinutes` | entier | non | |
| `points` | entier | non | Remplace les points par défaut de la plateforme. |

### 6.1 `lecon` — contenu rédigé

C'est l'activité qui remplace la parole du formateur. Elle se compose de **blocs** affichés dans l'ordre :

| Bloc | Champs | Rendu |
|---|---|---|
| `texte` | `markdown` | Paragraphes, listes, tableaux, liens. |
| `encadre` | `variante` (`a_retenir` \| `attention` \| `exemple` \| `cas` \| `definition`), `titre`?, `markdown` | Encadré coloré selon la variante. |
| `approfondir` | `titre`, `markdown`, `references`? (ids) | **Replié par défaut.** L'apprenant l'ouvre s'il veut aller plus loin. N'est jamais nécessaire pour réussir le quiz. |
| `image` | `fichier` ou `url`, `alt` (oblig.), `legende`? | Image centrée ; `alt` sert aux lecteurs d'écran. |
| `video` | `url`, `titre`, `transcription`? | Lecteur intégré ; transcription dépliable. |
| `references` | `ids` | Liste des références citées, avec lien. |

Principe de rédaction : le **socle** (texte, encadrés) suffit pour comprendre et réussir ; les blocs **Approfondir** répondent à « pourquoi ? », « d'où ça vient ? », « comment aller plus loin ? », et renvoient aux sources officielles.

### 6.2 `diaporama` — diapositives commentées

Pour réutiliser un diaporama existant (export en images d'un deck) en y ajoutant ce que le formateur aurait dit.

```json
{ "type": "diaporama", "id": "d1", "titre": "…",
  "diapos": [ { "image": "assets/m1/01.png", "alt": "…", "titre": "…",
                "explication": "markdown — le commentaire du formateur",
                "approfondir": { "titre": "…", "markdown": "…", "references": ["togaf-std"] } } ] }
```

### 6.3 `quiz`

| Champ | Description |
|---|---|
| `seuil` | Optionnel, remplace `progression.seuilReussite`. |
| `tirage` | Optionnel : nombre de questions tirées au hasard à chaque tentative. Sinon toutes. |
| `melangerOptions` | Booléen, `true` par défaut. |
| `questions[]` | `id`, `type` (`choix_unique` \| `choix_multiple` \| `vrai_faux`), `enonce`, `options[]` (`id`, `texte`), `bonnes[]` (ids d'options), `explication` (affichée après réponse), `indice`?, `references`? |

Règles : `choix_unique` et `vrai_faux` ont exactement une bonne réponse ; `vrai_faux` a exactement deux options. Une question `choix_multiple` n'est juste que si toutes les bonnes options et elles seules sont cochées.

### 6.4 `ordre`

`consigne`, `elements[]` (`id`, `texte`) **dans le bon ordre** — la plateforme les mélange —, `explication`.

### 6.5 `association`

`consigne`, `paires[]` (`id`, `gauche`, `droite`), `explication`. La plateforme mélange la colonne de droite.

### 6.6 `scenario` — cas à embranchements

```json
{ "type": "scenario", "id": "s1", "titre": "…", "contexte": "markdown",
  "debut": "n1",
  "noeuds": {
    "n1": { "texte": "markdown", "choix": [
      { "texte": "…", "points": 2, "retour": "…", "suivant": "n2" },
      { "texte": "…", "points": 0, "retour": "…", "suivant": "fin" } ] } },
  "paliers": [ { "minPoints": 5, "etoiles": 3, "message": "…" },
               { "minPoints": 3, "etoiles": 2, "message": "…" },
               { "minPoints": 0, "etoiles": 1, "message": "…" } ] }
```

- `points` d'un choix : 0, 1 ou 2.
- `suivant` vaut un identifiant de nœud ou `"fin"`.
- Contrôles à l'import : tout `suivant` existe, tous les nœuds sont atteignables depuis `debut`, aucune boucle.

### 6.7 `fiches`

`cartes[]` : `recto`, `verso` (markdown court).

---

## 7. Références

Déclarées une fois à la racine, citées par leur `id` dans les blocs et les questions.

| Champ | Oblig. | Description |
|---|---|---|
| `id` | oui | slug |
| `titre` | oui | |
| `source` | oui | Éditeur ou organisme (« The Open Group », « ISO »…). |
| `url` | non | Lien direct. Obligatoire sauf pour `livre` et `interne`. |
| `type` | oui | `officiel` \| `norme` \| `article` \| `livre` \| `video` \| `interne` |
| `acces` | oui | `libre` \| `inscription` \| `payant` \| `interne` |
| `langue` | oui | |
| `note` | non | Ce qu'on y trouve, en une phrase. |
| `consulteLe` | oui | Date à laquelle le lien a été vérifié. |

La plateforme affiche le type d'accès à côté du lien (« inscription gratuite requise », « payant ») pour ne pas surprendre l'apprenant. Un contrôle périodique des liens (administrateurs) signale les liens morts.

---

## 8. Glossaire

`glossaire[]` : `terme`, `definition` (markdown), `references`? Dans les textes, un terme du glossaire peut être balisé `[[terme]]` : la plateforme affiche la définition au survol ou au toucher.

---

## 9. Markdown accepté

CommonMark + tableaux GFM. **Pas de HTML brut** (supprimé à l'import). Liens `http(s)` uniquement, ouverts dans un nouvel onglet. Balise de glossaire `[[terme]]`.

---

## 10. Ce que gère la plateforme (et non le format)

- Les comptes, rôles, espaces production et démonstration.
- Les points d'expérience par défaut : leçon 10, diaporama 10, bonne réponse de quiz 10, ordre 30, association 20, étoile de scénario 20, fiches 10 ; bonus de 50 par module terminé.
- Les niveaux et les badges communs à toutes les formations.
- L'enregistrement de la progression, par `formation.id` + `module.id` + `activite.id`.

---

## 11. Import

1. **Validation** contre `formation.schema.json`, puis contrôles métier : unicité des identifiants, références citées existantes, fichiers présents, scénarios cohérents, bonnes réponses existantes.
2. **Rapport** lisible : erreurs bloquantes et avertissements, avec le chemin de l'élément (`modules[0].activites[3].questions[2]`).
3. **Destination** : toujours l'espace **démonstration** d'abord, pour relecture.
4. **Publication en production** par un administrateur, depuis l'espace démonstration.

Versions :

| Cas | Comportement |
|---|---|
| Nouvel `id` | Nouvelle formation. |
| Même `id`, `version` supérieure | Nouvelle version. La progression des apprenants est conservée pour les modules et activités dont l'`id` n'a pas changé. |
| Même `id`, même `version` | Refusé, sauf remplacement explicite en démonstration. |
| Même `id`, `version` inférieure | Refusé. |

---

## 12. Export

La plateforme sait réexporter toute formation au même format (aller-retour sans perte), pour la retravailler hors plateforme puis la réimporter.

---

## 13. Versions du format

- Une version mineure (`1.1`) ajoute seulement des champs ou des types facultatifs : la plateforme continue de lire les fichiers `1.0`.
- Une version majeure (`2.0`) peut casser la compatibilité : la plateforme fournit alors une conversion.
- Un fichier dont la `formatVersion` est inconnue de la plateforme est refusé avec un message explicite.

## 14. Hors périmètre de la version 1.0

Questions ouvertes à correction humaine, contenus SCORM ou xAPI (à importer par une autre voie), traductions multiples dans un même fichier.
