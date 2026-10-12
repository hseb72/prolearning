# Spécification d'interface — portail 3S - Pro Learning

Référence visuelle : le prototype validé par le porteur du projet. Ce document traduit le prototype en règles exactes. **En cas de doute, le prototype fait foi** : ouvrez `prototype/portail-formation.html` dans un navigateur (il fonctionne seul, en mode démonstration) et mesurez avec les outils du navigateur.

Contenu de ce dossier :

| Fichier | Rôle |
|---|---|
| `prototype/portail-formation.html` | Le prototype complet, autonome. Source de vérité pour tout détail non écrit ici. |
| `prototype/prototype.css` | Sa feuille de style extraite, telle quelle. Les valeurs ci-dessous en viennent. |
| `captures/*.png` | Les écrans de référence (1280 px, 390 px, thème sombre). Les captures « pleine page » montrent le sommaire collant du lecteur décalé : c'est un artefact de capture, il reste collé en haut à l'écran. |

---

## 1. Principes

- **Chaleureux et éditorial, pas administratif.** Fond crème, titres en sérif, accents orange, cartes douces. Aucune couleur par défaut d'un framework (pas de bleu primaire, pas de gris neutres froids).
- **Une colonne de lecture** de 1080 px maximum, centrée, marges latérales de 16 px.
- **Hiérarchie par la typographie** : sur-titre orange en petites capitales espacées → titre sérif → texte d'introduction gris.
- **Couleur porteuse de sens** : vert = en ligne / réussi, bleu = à distance / information, ocre = sur site / attention, rouge = refusé / erreur. Le sens est toujours aussi écrit en toutes lettres.
- **Thème clair et thème sombre** complets, pilotés par variables CSS.
- **Interface 100 % en français**, avec les libellés exacts du prototype (§ 9).

## 2. Jetons de design (à reprendre à l'identique)

### Couleurs — thème clair

| Variable | Valeur | Usage |
|---|---|---|
| `--bg` | `#F7F5F0` | Fond de page (crème) |
| `--surface` | `#FFFDF9` | Cartes, dialogues, champs sur fond carte |
| `--ink` | `#14213D` | Texte principal (bleu nuit) |
| `--muted` | `#4A5568` | Texte secondaire |
| `--line` | `#DDD8CE` | Bordures |
| `--accent` | `#B5561A` | Sur-titres, liens, focus |
| `--accent-fill` | `#E07A2E` | Boutons principaux, barres de progression, puces numérotées |
| `--on-accent` | `#14213D` | Texte sur `--accent-fill` (bleu nuit, pas blanc) |
| `--navy` | `#14213D` | En-tête, boutons et puces actifs |
| `--on-navy` | `#F7F5F0` | Texte sur `--navy` |
| `--navy-accent` | `#F0A060` | Accent sur fond bleu nuit (sous-titre du logo, onglet actif, pastilles) |
| `--good` / `--good-bg` | `#2F7D5B` / `#E4F2EA` | Succès, « En ligne », « Acceptée », « À retenir » |
| `--bad` / `--bad-bg` | `#A8392C` / `#F7E3DF` | Erreur, « Refusée », « Annulée » |
| `--warn` / `--warn-bg` | `#8A5A00` / `#FBEFD5` | « Sur site », « En cours », « Attention », bandeau démo |
| `--info` / `--info-bg` | `#2B5C8A` / `#E3EDF7` | « À distance », « Envoyée », « Exemple », « Définition », bandeau production |
| `--chip` | `#E9EEF3` | Puces neutres, fonds de pastilles, en-têtes de tableau |
| texte secondaire sur bleu nuit | `#BFCAD8` | Onglets inactifs, nom de l'utilisateur |

### Couleurs — thème sombre

Appliquées sous `@media (prefers-color-scheme: dark)` (sauf `data-theme="light"`) et sous `:root[data-theme="dark"]` :

`--bg #0F1830` · `--surface #18233F` · `--ink #EEF1F6` · `--muted #A9B4C6` · `--line #2C3A5C` · `--accent #F0A060` · `--accent-fill #E07A2E` · `--on-accent #14213D` · `--navy #0A1226` · `--on-navy #EEF1F6` · `--navy-accent #F0A060` · `--good #6CC79A` / `--good-bg #173528` · `--bad #F08A7C` / `--bad-bg #3A1E1C` · `--warn #E8C070` / `--warn-bg #3A2E14` · `--info #8DB8E6` / `--info-bg #1A2D47` · `--chip #223053` · `color-scheme: dark`.

Blocs de code : fond `#0F1830`, texte `#E8EDF5` dans les deux thèmes.

### Typographie

| Rôle | Police | Taille / graisse / interligne |
|---|---|---|
| Titres (`--display`) | **Source Serif 4**, repli Georgia, serif | h1 : `clamp(28px, 5vw, 40px)`, 600, 1.15, `text-wrap: balance` · h2 : 24px, 600 |
| Texte (`--body`) | **IBM Plex Sans**, repli Arial, sans-serif | 16px, 400, 1.5 ; h3 : 17px |
| Code | **JetBrains Mono**, repli ui-monospace, Menlo, Consolas | 13.5px dans les blocs, 0.92em en ligne |
| Logo | Source Serif 4 | 22px, 700, letter-spacing .3px |
| Sur-titre (`.eyebrow`) | IBM Plex Sans | 12px, 600, letter-spacing 2px, MAJUSCULES, `--accent` |
| Chiffres (stats, dates, scores) | Source Serif 4 | 26 à 56px, `font-variant-numeric: tabular-nums` |

Héberger les polices dans l'application (paquets `@fontsource/source-serif-4`, `@fontsource/ibm-plex-sans`, `@fontsource/jetbrains-mono`, graisses ci-dessus, sous-ensemble latin) plutôt que d'appeler Google Fonts : pas de dépendance externe, pas de transfert de données personnelles hors UE.

### Rayons, espacements, ombres

- Rayons : cartes et tuiles 14px · stats, encadrés et toasts 12px · blocs de date, champs, boutons et options de quiz 10px · dialogues 16px · pastilles et filtres 999px · blocs de code 10px.
- Espacements : grilles et listes 12 à 16px · padding de carte 20px · dialogue 24px · `main` : `24px 16px 64px`.
- Une seule ombre visible : le toast (`0 8px 24px rgba(0,0,0,.25)`). Le nœud « suivant » de la carte du parcours a un halo `0 0 0 4px` de `--accent-fill` à 18 %.
- Focus clavier : `outline: 3px solid var(--accent); outline-offset: 2px` sur tout élément interactif.

## 3. Structure de page

1. **En-tête** (fond `--navy`, padding latéral 16px), contenu limité à 1080px :
   - à gauche, le logo « 3S - Pro Learning » avec, dessous, « PORTAIL FORMATION INTERNE » (12px, 600, 2px, majuscules, `--navy-accent`) ;
   - à droite, le nom de l'utilisateur et son rôle (13px, `#BFCAD8`), puis, **pour les administrateurs uniquement**, la bascule « PRODUCTION | DÉMO » (pilule à bordure `#3A4A6B`, segment actif fond `--navy-accent` texte `#14213D`, 12px, 600) ;
   - dessous, la **barre d'onglets** : boutons sans fond, 10px 14px, `#BFCAD8`, 500 ; onglet actif en `--on-navy` souligné par une bordure basse de 3px `--navy-accent` ; défilement horizontal sans barre visible sur mobile ; compteur en pastille (`--navy-accent`, texte `#14213D`, 12px, 600) sur « Mes demandes » (demandes envoyées ou en cours) et « Administration » (demandes à traiter).
2. **Bandeau d'espace** sous l'en-tête, 13px, centré, padding 8px 16px : production → `--info-bg`/`--info` ; démonstration → `--warn-bg`/`--warn`. Textes exacts : § 9.
3. **Contenu** (`main`, 1080px max).
4. **Pied de page** 13px `--muted` : « 3S - Pro Learning · … » à gauche, mention à droite.

## 4. Composants (classes du prototype entre parenthèses)

- **Bouton principal** (`.btn`) : fond `--accent-fill`, texte `--on-accent`, 600, 15px, padding 10px 18px, rayon 10px. Variantes : `ghost` (transparent, bordure `--line`, texte `--ink`), `small` (13px, 6px 12px), `navy`. Désactivé : opacité .45.
- **Lien d'action** (`.link`) : sans fond, `--accent`, 600, souligné décalé de 3px.
- **Filtre** (`.chipbtn`) : pilule bordure `--line`, fond `--surface`, 14px, 6px 14px ; état actif `aria-pressed="true"` fond `--navy`, texte `--on-navy`.
- **Champ de recherche / select de filtre** (`.search`) : bordure `--line`, fond `--surface`, rayon 10px, 8px 12px.
- **Champ de formulaire** (`.inp`) : fond `--bg` (pas blanc), bordure `--line`, rayon 10px, 10px 12px ; libellé au-dessus en 14px 600, aide en `small` 400 `--muted`.
- **Choix exclusifs** (`.radios`) : boutons radio dans des étiquettes-pastilles bordées, rayon 10px.
- **Carte** (`.card`) : fond `--surface`, bordure 1px `--line`, rayon 14px, padding 20px.
- **Carte formation** (`.fcard`) : sur-titre du thème en `--muted`, titre h3, pastilles de modalité, durée en petit, pied collé en bas avec info à gauche et « Voir la fiche » (`.btn.small`) à droite. Grille `repeat(auto-fill, minmax(300px, 1fr))`, gap 16px.
- **Pastilles** (`.tag`) : 12px, 600, 3px 9px, pilule. `online` vert, `distance` bleu, `site` ocre, défaut `--chip`.
- **Statut de demande** (`.status`) : pilule 12px 600 : envoyée bleu, en cours ocre, acceptée vert, refusée/annulée rouge, liste d'attente neutre.
- **Stat** (`.stat`) : carte 12px de rayon, 12px 16px, min 150px ; chiffre en sérif 28px, libellé 13px `--muted`.
- **Ligne de session** (`.session`) : grille `72px 1fr auto`. Bloc date (`.date`) fond `--chip` : jour en sérif 26px, mois en 12px majuscules. Jauge de places : 4px de haut, max 220px, remplissage `--accent-fill`. Sous 640px : date 60px, bouton en pleine largeur dessous.
- **Fil d'étapes d'une demande** (`.steps`) : « Envoyée · En traitement · Décision », petites pastilles 12px, étapes atteintes en `--navy`.
- **Dialogue** (`dialog` natif) : rayon 16px, fond `--surface`, largeur `min(560px, 100vw - 32px)`, fond d'écran `rgba(10,18,38,.55)`, contenu en grille gap 14px, actions alignées à droite. Jamais `alert()` ni `confirm()`.
- **Toast** : en bas au centre, fond `--navy`, texte `--on-navy`, 15px, rayon 12px, ombre ; les mots clés en gras `--navy-accent` ; disparaît après 3,6 s ; `role="status"`.
- **État vide** (`.empty`) : centré, 40px de marge intérieure, `--muted`, avec un lien d'action.
- **Tableau d'administration** (`table.bo`) : 14px, en-têtes 12px majuscules espacées `--muted`, filets bas `--line`, enveloppe à défilement horizontal.
- **Zone de dépôt** (`.drop`) : bordure 2px pointillée `--line`, rayon 14px, fond `--bg`, centrée ; bordure `--accent` au survol d'un glisser.
- **Rapport d'import** : ligne de synthèse (« N erreurs bloquantes » rouge / « format valide » vert, « N avertissements » ocre), puis une ligne par erreur préfixée « ✕ » (rouge) ou « ! » (ocre).

### Parcours en ligne et lecteur

- **Carte de niveau** (`.hero`, grille `1.2fr 1fr`, une colonne sous 760px) : anneau SVG 84px (piste `--chip`, arc `--accent-fill` épaisseur 8, bouts arrondis, « n/9 » au centre), niveau en sérif 26px (Apprenti < 200 pts, Praticien < 500, Architecte), barre de progression 8px.
- **Badges** (`.badges`, grille 3 colonnes) : icône 36px orange, nom en gras, description ; badge non obtenu à 38 % d'opacité et en niveaux de gris.
- **Carte des modules** (`.map`, `repeat(auto-fill, minmax(150px, 1fr))`) : tuile (`.node`) rayon 14px, min 120px de haut, numéro en sérif 30px 700 `--accent` ; états : `done` (bordure et ✓ verts), `next` (bordure 2px `--accent-fill` + halo), `locked` (opacité .55, curseur interdit), `special` (mission, fond `--navy`).
- **Lecteur** (`.player`) : grille `260px 1fr`, gap 20px ; une colonne sous 820px.
  - **Sommaire** (`.toc`) collant à 12px du haut : titre « MODULE N » en sur-titre gris ; une ligne par activité avec pastille ronde 18px (vide, ou verte avec ✓) ; activité courante sur fond `--chip`, en gras ; sous 820px, sommaire horizontal défilant de pastilles bordées, sans titre.
  - **Fil d'Ariane** (`.crumbs`) 14px : « ← Retour » ou « ← Modules » en lien, puis le chemin en `--muted`.
  - **En-tête d'activité** : sur-titre « LEÇON · 7 MIN » (type + durée), titre h2.
  - **Prose** (`.prose`, 72ch max) : paragraphes 12px d'écart ; tableaux pleine largeur, en-tête fond `--chip`, 14px ; liens `--accent` 600 ; termes du glossaire soulignés en pointillé `--accent`, définition au survol et au focus.
  - **Encadrés** (`.enc`) : rayon 12px, bordure gauche 4px, petit libellé en majuscules (« À RETENIR », « ATTENTION », « EXEMPLE », « DÉFINITION », « CAS »), titre facultatif 15px. Couleurs : à retenir vert, attention ocre, exemple et définition bleu, cas fond `--chip` + bordure `--accent-fill`.
  - **Approfondir** (`details.ap`) : replié par défaut ; résumé = puce ronde 22px orange « + » / « – », titre en gras, mention « APPROFONDIR » à droite (masquée sous 560px) ; contenu en retrait de 48px ; références dessous.
  - **Références** (`.refs`) : cartes `--bg` rayon 8px ; titre-lien `--accent`, pastille d'accès (Accès libre vert, Inscription requise bleu, Payant ocre, Interne neutre), puis source, langue et note en petit.
  - **Quiz** : énoncé en sérif 21px ; options (`.opt`) en cartes `--bg` avec lettre A/B/C/D dans une pastille ronde 26px ; bonne réponse fond `--good-bg` + bordure verte + pastille verte ; mauvaise rouge ; retour (`.fb`) fond `--chip` avec « Bonne réponse » vert ou « Pas tout à fait » rouge ; choix multiple : cases à cocher + bouton « Valider » ; barre de progression du quiz ; écran de résultat centré, score en sérif 56px, pastille animée « +N points d'expérience ».
  - **Ordre** (`.order`) : lignes glissables avec poignée « ⋮⋮ » et boutons ↑ ↓ (32px) pour le clavier ; après vérification, lignes vertes ou rouges.
  - **Association** (`.assoc`) : lignes `1fr 200px` (une colonne sous 560px) avec un `select` par ligne ; vertes ou rouges après vérification.
  - **Mise en situation** : texte de la scène bordé à gauche de 4px `--accent-fill` ; options comme le quiz ; retour « Excellent choix » / « Correct, mais… » / « Conséquence » ; bilan avec étoiles 40px `--accent-fill` (étoiles vides en `--chip`) et rappel de chaque choix.
  - **Fiches** (`.cards`, `repeat(auto-fill, minmax(220px, 1fr))`) : carte à retourner, recto fond `--bg` libellé « QUESTION », verso fond `--navy` libellé « RÉPONSE » `--navy-accent`.
  - **Travaux pratiques** : encadré « OBJECTIF » (vert), encadré « POINT DE DÉPART » (cas) ; « Fichiers fournis » en volets repliables (nom en police à chasse fixe + description) ; étapes numérotées (`.tp-steps`, numéro dans une pastille ronde 28px `--navy`), chacune suivie d'un encadré vert « RÉSULTAT ATTENDU » ; « Vérifiez votre travail » : cases à cocher en cartes (vertes une fois cochées) ; volets « Dépannage » et « Nettoyage » ; bouton de fin actif seulement quand tout est coché.
  - **Blocs de code** : fond `#0F1830`, texte `#E8EDF5`, rayon 10px, 14px 16px, défilement horizontal, **bouton « Copier »** en haut à droite (12px, bordure `#3A4A6B`) qui affiche « Copié » 1,8 s.
  - **Pied d'activité** : bouton principal aligné à droite (« J'ai lu, continuer », « Activité suivante », « Terminer le module », « Vérifier »…).

## 5. Écrans (captures de référence)

| Écran | Captures | Points clés |
|---|---|---|
| Catalogue | `01-catalogue`, `-mobile`, `-sombre` | Sur-titre « CATALOGUE », h1, introduction, 3 stats, filtres (pilules + select thème + recherche), grille de cartes |
| Fiche formation (dialogue) | `02-catalogue-fiche` | Thème, titre, pastilles, objectifs, public/prérequis/durée, prochaines sessions avec lien d'inscription, actions |
| Sessions | `03-sessions`, `-mobile`, `-sombre` | Filtres de modalité + select formation, lignes de session avec date, pastilles, jauge de places, bouton ou « Demande envoyée » |
| Demande d'inscription (dialogue) | `04-dialog-inscription` | Message facultatif, case « J'ai informé mon manager », alerte ocre si complet |
| Session sur mesure | `05-session-sur-mesure` | Formulaire carte, 720px max, champs en deux colonnes, modalité en pastilles, lieu masqué si « À distance » |
| Mes demandes | `06-mes-demandes`, `06-…-avec-toast` | Carte par demande : type et date en sur-titre, statut à droite, détails en liste de définitions, fil d'étapes, « Annuler la demande » |
| Administration | `07-admin-demandes`, `08-admin-import-erreurs`, `09a-admin-import-valide`, `09b-admin-formations-evaluation` | Stats par statut, tableau des demandes avec actions, zone d'import, rapport, listes Évaluation / Démonstration / Production, réinitialisation de la démo |
| Mon parcours | `10-parcours-carte`, `-mobile` | Carte de niveau, badges, tuiles des modules, mission, case « Tout débloquer pour la démonstration » |
| Vue d'ensemble d'une formation | `19-formation-vue-ensemble` | Résumé, stats, tuiles des modules |
| Lecteur | `11`, `12`, `13`, `14`, `15`, `16`, `17`, `18`, `20`, `21` (+ `11-…-mobile`, `11-…-sombre`) | Leçon avec Approfondir ouvert, association, mise en situation (choix et bilan), fiches, quiz (question et résultat), ordre, travaux pratiques, leçon avec code |
| Bandeaux d'espace | `22-bandeau-production`, `23-bandeau-demo` | Bascule administrateur, couleurs du bandeau |

## 6. Responsive

Points de rupture du prototype : 820px (lecteur sur une colonne, sommaire horizontal), 760px (carte de niveau sur une colonne), 640px (lignes de session), 560px (formulaires et associations sur une colonne, mention « APPROFONDIR » masquée). Rien ne déborde horizontalement à 375px ; seuls la barre d'onglets, le sommaire mobile, les tableaux et les blocs de code défilent.

## 7. Mouvement

Sobre : transitions de largeur des barres de progression (.25 à .4s), pastille « +N points » qui apparaît en rebond (.5s). Tout est désactivé sous `prefers-reduced-motion: reduce`.

## 8. Accessibilité (non négociable)

Contrastes du tableau § 2 conservés ; focus visible partout ; navigation et onglets au clavier ; `aria-current="page"` sur l'onglet actif, `aria-pressed` sur les filtres et la bascule, `aria-current="step"` sur l'activité courante, `aria-live` sur les retours de quiz et les toasts ; alternative clavier à chaque glisser-déposer ; images avec `alt`.

## 9. Libellés exacts (extraits)

Onglets : « Catalogue », « Sessions », « Session sur mesure », « Mes demandes », « Mon parcours en ligne », « Administration ».
Bandeaux : production « Espace production · … » (bleu) ; démonstration « Espace démonstration · données de test, visibles des seuls administrateurs. » (ocre).
Statuts : « Envoyée », « En cours de traitement », « Acceptée », « Liste d'attente », « Refusée », « Annulée ».
Accès aux références : « Accès libre », « Inscription requise », « Payant », « Interne ».
Pour tout autre libellé, reprendre le texte du prototype mot pour mot (rechercher dans `prototype/portail-formation.html`).
