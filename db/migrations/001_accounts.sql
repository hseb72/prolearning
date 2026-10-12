-- Comptes, sessions, connexions OIDC en cours et journal.
--
-- Appliqué aux deux bases. En production, pl_users porte les vrais comptes (identité
-- prouvée par Keycloak, rôle tenu ici) ; en démonstration, des comptes fictifs dont
-- l'administrateur joue le rôle. Les sessions et les connexions OIDC ne servent qu'en
-- production : l'identité de la personne connectée vit là, quel que soit l'espace actif.

CREATE TYPE pl_role AS ENUM ('employee', 'manager', 'training', 'admin');

CREATE TABLE pl_users (
  id             bigserial    PRIMARY KEY,
  -- Identifiant Keycloak (`sub`). Vide pour un compte fictif de démonstration.
  oidc_subject   varchar(255) UNIQUE,
  email          varchar(320) NOT NULL,
  display_name   varchar(200) NOT NULL,
  role           pl_role      NOT NULL DEFAULT 'employee',
  manager_id     bigint       REFERENCES pl_users (id) ON DELETE SET NULL,
  active         boolean      NOT NULL DEFAULT true,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  last_login_at  timestamptz,
  CONSTRAINT pl_users_not_own_manager CHECK (manager_id IS NULL OR manager_id <> id)
);
CREATE UNIQUE INDEX pl_users_email_key ON pl_users (lower(email));
CREATE INDEX pl_users_manager_idx ON pl_users (manager_id);

CREATE TABLE pl_sessions (
  -- Empreinte SHA-256 du jeton : le jeton lui-même n'est jamais stocké.
  token_hash      char(64)     PRIMARY KEY,
  user_id         bigint       NOT NULL REFERENCES pl_users (id) ON DELETE CASCADE,
  -- Espace choisi par un administrateur ; toujours « production » pour les autres.
  active_space    varchar(16)  NOT NULL DEFAULT 'production'
                               CHECK (active_space IN ('production', 'demo')),
  -- Compte fictif joué en démonstration (identifiant dans la base de démonstration,
  -- donc sans clé étrangère : les deux bases ne se référencent jamais).
  demo_persona_id bigint,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  expires_at      timestamptz  NOT NULL,
  user_agent      varchar(255)
);
CREATE INDEX pl_sessions_user_idx ON pl_sessions (user_id);
CREATE INDEX pl_sessions_expires_idx ON pl_sessions (expires_at);

-- Connexions OIDC en cours : état, vérificateur PKCE et nonce, le temps de l'aller-retour
-- avec Keycloak (quelques minutes au plus).
CREATE TABLE pl_oidc_requests (
  state          varchar(128) PRIMARY KEY,
  code_verifier  varchar(128) NOT NULL,
  nonce          varchar(128) NOT NULL,
  return_to      varchar(512) NOT NULL DEFAULT '/',
  expires_at     timestamptz  NOT NULL
);

-- Journal : qui, quand, quoi (connexions, bascules d'espace, changements de rôle…).
CREATE TABLE pl_audit_log (
  id           bigserial    PRIMARY KEY,
  occurred_at  timestamptz  NOT NULL DEFAULT now(),
  actor_id     bigint       REFERENCES pl_users (id) ON DELETE SET NULL,
  -- Libellé figé au moment de l'action : le journal reste lisible si le compte disparaît.
  actor_label  varchar(320),
  action       varchar(64)  NOT NULL,
  details      jsonb        NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX pl_audit_log_occurred_idx ON pl_audit_log (occurred_at DESC);
