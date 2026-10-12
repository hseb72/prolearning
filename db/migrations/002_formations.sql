-- Formations au format d'échange 3S (docs/format/format-formation-3s.md).
--
-- Chaque version importée est conservée telle que déposée (`source`, texte exact) :
-- l'export la restitue octet pour octet, d'où un aller-retour sans perte. `content`
-- en est la lecture structurée, pour l'affichage et le lecteur.
--
-- Appliqué aux deux bases : l'import se fait en démonstration, la publication recopie
-- la version en production (même table, autre base).

CREATE TABLE pl_formations (
  id               varchar(64)  PRIMARY KEY,   -- `id` du format (slug, stable entre versions)
  current_version  varchar(32)  NOT NULL,      -- la plus haute version importée
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE pl_formation_versions (
  formation_id       varchar(64)  NOT NULL REFERENCES pl_formations (id) ON DELETE CASCADE,
  version            varchar(32)  NOT NULL,
  -- Version décomposée, pour comparer numériquement (1.10.0 > 1.9.0).
  version_major      integer      NOT NULL,
  version_minor      integer      NOT NULL,
  version_patch      integer      NOT NULL,
  format_version     varchar(8)   NOT NULL,
  titre              text         NOT NULL,
  theme              text         NOT NULL,
  source             text         NOT NULL,
  content            jsonb        NOT NULL,
  sha256             char(64)     NOT NULL,
  origin             varchar(16)  NOT NULL CHECK (origin IN ('import', 'publication')),
  imported_at        timestamptz  NOT NULL DEFAULT now(),
  -- Compte de CETTE base (le compte joué en démonstration) ; le libellé garde la
  -- personne réelle, pour le journal (qui, quand, quelle version).
  imported_by        bigint       REFERENCES pl_users (id) ON DELETE SET NULL,
  imported_by_label  varchar(320),
  -- Démonstration : date de publication de cette version en production.
  published_at       timestamptz,
  PRIMARY KEY (formation_id, version)
);
CREATE INDEX pl_formation_versions_order_idx
  ON pl_formation_versions (formation_id, version_major DESC, version_minor DESC, version_patch DESC);
