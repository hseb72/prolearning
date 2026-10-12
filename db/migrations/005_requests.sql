-- Demandes (étape 5) : inscriptions aux sessions en direct et sessions sur mesure.
--
-- Inscription (décision 4 de CLAUDE.md) : le collaborateur demande, son manager valide,
-- l'équipe formation confirme dans la limite des places. Une inscription confirmée occupe
-- une place dans `pl_session_registrations` (étape 4), mise à jour dans la même
-- transaction que la demande.

CREATE TABLE pl_registration_requests (
  id           bigserial     PRIMARY KEY,
  session_id   bigint        NOT NULL REFERENCES pl_course_sessions (id) ON DELETE CASCADE,
  user_id      bigint        NOT NULL REFERENCES pl_users (id) ON DELETE CASCADE,
  statut       varchar(24)   NOT NULL CHECK (statut IN
                 ('attente_manager', 'attente_formation', 'confirmee', 'refusee', 'annulee')),
  motif        text          NOT NULL DEFAULT '',   -- message du demandeur
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now()
);
-- Une seule demande en cours par personne et par session.
CREATE UNIQUE INDEX pl_registration_requests_active_idx
  ON pl_registration_requests (session_id, user_id)
  WHERE statut IN ('attente_manager', 'attente_formation', 'confirmee');
CREATE INDEX pl_registration_requests_user_idx ON pl_registration_requests (user_id);
CREATE INDEX pl_registration_requests_statut_idx ON pl_registration_requests (statut);

-- Demande de session sur mesure, faite par un manager pour son équipe.
CREATE TABLE pl_custom_requests (
  id              bigserial     PRIMARY KEY,
  requester_id    bigint        NOT NULL REFERENCES pl_users (id) ON DELETE CASCADE,
  course_id       varchar(64)   REFERENCES pl_courses (id) ON DELETE SET NULL,
  sujet           text          NOT NULL,
  modalite        varchar(16)   NOT NULL CHECK (modalite IN ('distance', 'site', 'indifferent')),
  participants    integer       NOT NULL CHECK (participants BETWEEN 1 AND 500),
  periode         text          NOT NULL DEFAULT '',
  details         text          NOT NULL DEFAULT '',
  statut          varchar(16)   NOT NULL CHECK (statut IN
                    ('a_traiter', 'en_cours', 'acceptee', 'refusee', 'annulee')),
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX pl_custom_requests_requester_idx ON pl_custom_requests (requester_id);

-- Historique des deux sortes de demandes : qui a fait quoi, quand, avec quel commentaire.
CREATE TABLE pl_request_events (
  id            bigserial     PRIMARY KEY,
  kind          varchar(16)   NOT NULL CHECK (kind IN ('inscription', 'sur_mesure')),
  request_id    bigint        NOT NULL,
  statut        varchar(24)   NOT NULL,           -- statut après l'événement
  actor_id      bigint        REFERENCES pl_users (id) ON DELETE SET NULL,
  actor_name    text          NOT NULL DEFAULT '',
  commentaire   text          NOT NULL DEFAULT '',
  created_at    timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX pl_request_events_request_idx ON pl_request_events (kind, request_id, id);
