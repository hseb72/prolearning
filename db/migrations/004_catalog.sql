-- Catalogue et sessions (étape 4).
--
-- Une fiche formation décrit une formation proposée aux collaborateurs : en direct
-- (sessions à distance ou sur site), en ligne (parcours importé au format d'échange,
-- `formation_id`), ou les deux. Fiches et sessions sont tenues par l'équipe formation.

CREATE TABLE pl_courses (
  id             varchar(64)   PRIMARY KEY,          -- slug, dans l'adresse de la fiche
  titre          text          NOT NULL,
  theme          text          NOT NULL,
  resume         text          NOT NULL,             -- markdown
  objectifs      text[]        NOT NULL DEFAULT '{}',
  public         text          NOT NULL DEFAULT '',
  prerequis      text          NOT NULL DEFAULT '',
  duree_heures   numeric(5, 1) CHECK (duree_heures > 0),  -- durée d'une session en direct
  -- Parcours en ligne associé ; la fiche reste si le parcours disparaît.
  formation_id   varchar(64)   REFERENCES pl_formations (id) ON DELETE SET NULL,
  publiee        boolean       NOT NULL DEFAULT false,   -- visible des collaborateurs
  created_at     timestamptz   NOT NULL DEFAULT now(),
  updated_at     timestamptz   NOT NULL DEFAULT now(),
  updated_by     bigint        REFERENCES pl_users (id) ON DELETE SET NULL
);

CREATE TABLE pl_course_sessions (
  id           bigserial     PRIMARY KEY,
  course_id    varchar(64)   NOT NULL REFERENCES pl_courses (id) ON DELETE CASCADE,
  modalite     varchar(16)   NOT NULL CHECK (modalite IN ('distance', 'site')),
  debut        timestamptz   NOT NULL,
  fin          timestamptz   NOT NULL CHECK (fin > debut),
  -- Sur site : adresse et salle. À distance : outil de visioconférence (le lien est
  -- communiqué aux inscrits, étape 5).
  lieu         text          NOT NULL DEFAULT '',
  formateur    text          NOT NULL DEFAULT '',
  places       integer       NOT NULL CHECK (places > 0 AND places <= 1000),
  annulee      boolean       NOT NULL DEFAULT false,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX pl_course_sessions_course_idx ON pl_course_sessions (course_id, debut);
CREATE INDEX pl_course_sessions_debut_idx ON pl_course_sessions (debut);

-- Places occupées d'une session. Les demandes d'inscription et leur validation par le
-- manager arrivent à l'étape 5 ; une place n'est prise que par une inscription confirmée.
CREATE TABLE pl_session_registrations (
  session_id   bigint        NOT NULL REFERENCES pl_course_sessions (id) ON DELETE CASCADE,
  user_id      bigint        NOT NULL REFERENCES pl_users (id) ON DELETE CASCADE,
  statut       varchar(16)   NOT NULL CHECK (statut IN ('confirmee', 'annulee')),
  created_at   timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);
