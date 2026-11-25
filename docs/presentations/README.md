# Présentations des parcours en ligne

Présentations PowerPoint (`.pptx`) générées à partir des fichiers de formation de `fixtures/formations/`. Elles servent à présenter un parcours (réunion, communication interne) ; elles ne sont pas utilisées par la plateforme.

| Fichier                        | Parcours                                                        |
| ------------------------------ | --------------------------------------------------------------- |
| `llm-comprendre-utiliser.pptx` | IA générative : comprendre et bien utiliser les LLM (4 modules) |
| `llm-developper.pptx`          | Développer avec les LLM (5 modules)                             |

Contenu : titre, public et prérequis, objectifs, frise des modules, progression type d'un module, une diapositive par module (programme, mise en situation, TP, objectifs), conclusion. Chaque diapositive a des notes de l'orateur en français.

Charte 3S - Pro Learning (bleu nuit, orange, fond crème), dans le thème du fichier. Polices Cambria et Calibri, présentes sur tous les postes Office, à la place de Source Serif 4 et IBM Plex Sans.

## Régénérer

Après une modification d'une formation :

```bash
cd docs/presentations
npm ci
npm run build
```

Pour un autre parcours : `node generer-presentation.js <formation.json> <sortie.pptx> ["titre du parcours suivant"]`.
