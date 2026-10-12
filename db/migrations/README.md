# Migrations SQL

Scripts appliqués par l'API au démarrage (`server/src/migrate.ts`), dans l'ordre
alphabétique, **à la base de chaque espace** (production et démonstration) : les deux
bases ont toujours le même schéma.

- Nommage : `NNN_sujet.sql` (`001_comptes.sql`, `002_journal.sql`…). Un script déjà
  appliqué ne se modifie plus : on en ajoute un nouveau.
- Chaque script s'exécute dans une transaction ; en cas d'échec, rien n'est enregistré
  et l'API ne démarre pas.
- Tables préfixées `pl_`. La table `pl_migrations` est réservée au mécanisme.
- Pas de colonne « espace » : l'espace, c'est la base.
