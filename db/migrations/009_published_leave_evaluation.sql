-- Une version publiée en production quitte l'évaluation (décision du 13 octobre 2026).
-- `published_at` n'est renseigné que dans la base d'évaluation : en production et en
-- démonstration, ce script ne trouve rien à faire.

DELETE FROM pl_formation_versions WHERE published_at IS NOT NULL;

-- Formations restées sans version : elles partent aussi.
DELETE FROM pl_formations f
 WHERE NOT EXISTS (SELECT 1 FROM pl_formation_versions v WHERE v.formation_id = f.id);

-- Les autres repointent sur leur plus haute version restante.
UPDATE pl_formations f
   SET current_version = top.version, updated_at = now()
  FROM (
    SELECT DISTINCT ON (formation_id) formation_id, version
      FROM pl_formation_versions
     ORDER BY formation_id, version_major DESC, version_minor DESC, version_patch DESC
  ) AS top
 WHERE top.formation_id = f.id AND f.current_version <> top.version;
