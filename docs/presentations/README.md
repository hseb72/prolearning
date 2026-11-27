# Présentations

Présentations PowerPoint (`.pptx`), générées par script : celles des parcours en ligne à partir des fichiers de formation de `fixtures/formations/`, celle du socle à partir de son contenu rédigé dans le script. Elles servent en réunion ou en communication interne ; elles ne sont pas utilisées par la plateforme.

| Fichier                        | Contenu                                                         |
| ------------------------------ | --------------------------------------------------------------- |
| `llm-comprendre-utiliser.pptx` | IA générative : comprendre et bien utiliser les LLM (4 modules) |
| `llm-developper.pptx`          | Développer avec les LLM (5 modules)                             |

Parcours LLM — contenu : titre, public et prérequis, objectifs, frise des modules, progression type d'un module, une diapositive par module (programme, mise en situation, TP, objectifs), conclusion. Chaque diapositive a des notes de l'orateur en français.

Charte 3S - Pro Learning (bleu nuit, orange, fond crème), dans le thème du fichier. Polices Cambria et Calibri, présentes sur tous les postes Office, à la place de Source Serif 4 et IBM Plex Sans.

Socle et patterns — un récit en huit actes (standards, patterns d'architecture, patterns d'implémentation, socle, chaîne du dépôt à la production, pilotes xpms et TreasureHunters, reproduction avec la chronologie de ProLearning, démarche qui se corrige). Contenu rédigé dans `generer-socle.js` à partir des dépôts `platform-patterns`, `homelab-platform` et de l'historique de ProLearning (27 novembre 2026) ; notes de l'orateur en français, avec les sources.

## Régénérer

Après une modification d'une formation ou du contenu :

```bash
cd docs/presentations
npm ci
npm run build
```

Pour un autre parcours : `node generer-presentation.js <formation.json> <sortie.pptx> ["titre du parcours suivant"]`.
