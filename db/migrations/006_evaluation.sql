-- Espace d'évaluation (CLAUDE.md, « Espaces ») : les formations importées vivent dans une
-- troisième base, jamais réinitialisée. De là, on les publie en production ou on les copie
-- en démonstration. Ces colonnes servent dans la base d'évaluation (mêmes scripts partout).

-- Date de la dernière copie de cette version en démonstration.
ALTER TABLE pl_formation_versions ADD COLUMN copied_to_demo_at timestamptz;

-- Une version peut arriver par import (évaluation), publication (production) ou copie (démo).
ALTER TABLE pl_formation_versions DROP CONSTRAINT pl_formation_versions_origin_check;
ALTER TABLE pl_formation_versions
  ADD CONSTRAINT pl_formation_versions_origin_check
  CHECK (origin IN ('import', 'publication', 'copie'));
