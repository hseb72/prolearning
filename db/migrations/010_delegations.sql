-- Suppléance d'un manager (26 novembre 2026) : pendant une période, un collaborateur désigné
-- valide à sa place les demandes d'inscription de son équipe. Le manager garde la main
-- (validation partagée). Une seule suppléance, en cours ou à venir, par manager.
CREATE TABLE pl_delegations (
  manager_id   bigint       PRIMARY KEY REFERENCES pl_users (id) ON DELETE CASCADE,
  delegate_id  bigint       NOT NULL REFERENCES pl_users (id) ON DELETE CASCADE,
  -- Dates de Paris, bornes comprises.
  debut        date         NOT NULL,
  fin          date         NOT NULL,
  created_by   bigint       REFERENCES pl_users (id) ON DELETE SET NULL,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT pl_delegations_not_self CHECK (delegate_id <> manager_id),
  CONSTRAINT pl_delegations_period CHECK (fin >= debut)
);
CREATE INDEX pl_delegations_delegate_idx ON pl_delegations (delegate_id);

-- Validation faite en suppléance : pour le compte de quel manager.
ALTER TABLE pl_request_events
  ADD COLUMN for_id   bigint REFERENCES pl_users (id) ON DELETE SET NULL,
  ADD COLUMN for_name text   NOT NULL DEFAULT '';
