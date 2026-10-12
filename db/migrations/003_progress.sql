-- Progression dans les parcours en ligne, par apprenant (compte de CETTE base : chaque
-- espace a ses comptes et sa progression). Rattachée à `formation.id` + `module.id` +
-- `activite.id` : elle survit aux nouvelles versions tant que les identifiants restent.
-- Visible de l'apprenant seul (décision 5).

CREATE TABLE pl_activity_results (
  user_id        bigint       NOT NULL REFERENCES pl_users (id) ON DELETE CASCADE,
  formation_id   varchar(64)  NOT NULL,
  module_id      varchar(64)  NOT NULL,
  activite_id    varchar(64)  NOT NULL,
  activite_type  varchar(16)  NOT NULL,
  -- Meilleur résultat obtenu : 'reussie' > 'faite' > 'echouee'.
  status         varchar(16)  NOT NULL CHECK (status IN ('faite', 'reussie', 'echouee')),
  best_score     numeric,
  points         integer      NOT NULL DEFAULT 0,
  attempts       integer      NOT NULL DEFAULT 0,
  first_done_at  timestamptz,
  updated_at     timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, formation_id, module_id, activite_id)
);

CREATE TABLE pl_module_completions (
  user_id       bigint       NOT NULL REFERENCES pl_users (id) ON DELETE CASCADE,
  formation_id  varchar(64)  NOT NULL,
  module_id     varchar(64)  NOT NULL,
  bonus         integer      NOT NULL,
  completed_at  timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, formation_id, module_id)
);

-- Tentatives de quiz : les questions tirées et l'ordre des options, pour corriger ce qui
-- a réellement été posé (tirage aléatoire, § 6.3).
CREATE TABLE pl_quiz_attempts (
  id            bigserial    PRIMARY KEY,
  user_id       bigint       NOT NULL REFERENCES pl_users (id) ON DELETE CASCADE,
  formation_id  varchar(64)  NOT NULL,
  module_id     varchar(64)  NOT NULL,
  activite_id   varchar(64)  NOT NULL,
  question_ids  text[]       NOT NULL,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  submitted_at  timestamptz
);
CREATE INDEX pl_quiz_attempts_user_idx ON pl_quiz_attempts (user_id, created_at);
