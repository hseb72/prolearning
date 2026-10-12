# Kit de lancement — portail de formation 3S - Pro Learning

Ce kit contient de quoi démarrer le développement avec Claude Code.

```
CLAUDE.md                                   contexte du projet, lu par Claude Code à chaque session
docs/format/format-formation-3s.md          spécification du format d'échange des formations (v1.0)
docs/format/formation.schema.json           schéma JSON de validation
fixtures/formations/togaf10-m1.formation.json   formation exemple : TOGAF 10, module 1 complet
tools/valider-formation.js                  validateur de référence (schéma + contrôles métier)
```

## Démarrer

1. Créez un dépôt Git vide (GitHub ou autre) et copiez-y le contenu de ce kit, tel quel, à la racine.
2. Ouvrez le dépôt avec Claude Code.
3. Premier message suggéré :

   > Lis CLAUDE.md et la spécification du format. Pose-moi les questions de la section « Décisions à prendre au démarrage », puis propose un plan pour l'étape 1 (socle et espaces production/démo) avant d'écrire du code.

4. Ajoutez dans `CLAUDE.md`, section « Documents de référence », les liens vers la page de cadrage et le prototype.

## Produire une formation hors plateforme

Dans une conversation Claude (hors Claude Code), demandez une formation « au format 3S 1.0 » en joignant `format-formation-3s.md` et `formation.schema.json`, ou en reprenant la conversation où ce format a été défini. Vérifiez le fichier obtenu :

```
npm install ajv@8
node tools/valider-formation.js ma-formation.formation.json
```

Puis importez-le dans la plateforme, rubrique Administration > Formations (il arrive dans l'espace d'évaluation, d'où on le publie en production ou on le copie en démonstration).
