-- Données personnelles (étape 7, CLAUDE.md) : durées de conservation paramétrables par
-- les administrateurs. Chaque base garde ses propres réglages : la purge planifiée applique
-- à chaque espace les siens.

CREATE TABLE pl_settings (
  key         varchar(64)   PRIMARY KEY,
  value       jsonb         NOT NULL,
  updated_at  timestamptz   NOT NULL DEFAULT now(),
  updated_by  bigint        REFERENCES pl_users (id) ON DELETE SET NULL
);

-- Valeurs par défaut décidées le 13 octobre 2026 : demandes clôturées gardées 3 ans,
-- journal 1 an, comptes signalés après 1 an sans connexion (jamais supprimés d'office).
INSERT INTO pl_settings (key, value) VALUES
  ('retention', '{"requestsMonths": 36, "auditMonths": 12, "inactiveMonths": 12}');
