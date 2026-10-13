-- Publication des réussites (décision 5 de CLAUDE.md) : les résultats des parcours en ligne
-- ne sont visibles que de l'apprenant, sauf s'il choisit, parcours par parcours, de les
-- montrer à son manager ou à tous. Pas de ligne : privé.

CREATE TABLE pl_achievement_shares (
  user_id       bigint       NOT NULL REFERENCES pl_users (id) ON DELETE CASCADE,
  formation_id  varchar(64)  NOT NULL,
  visibility    varchar(16)  NOT NULL CHECK (visibility IN ('manager', 'communaute')),
  updated_at    timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, formation_id)
);
CREATE INDEX pl_achievement_shares_visibility_idx ON pl_achievement_shares (visibility);
