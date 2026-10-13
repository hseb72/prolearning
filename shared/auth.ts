import type { Role } from './roles.js';
import type { Space } from './spaces.js';

/** Un compte tel que le voit l'interface. */
export interface AccountSummary {
  id: number;
  displayName: string;
  email: string;
  role: Role;
}

/** Réponse de GET /api/auth/config : modes de connexion proposés. */
export interface AuthConfig {
  sso: boolean;
  devLogin: boolean;
}

/** Réponse de GET /api/auth/me. */
export interface Me {
  /** La personne connectée (compte de production). */
  user: AccountSummary;
  /** Espace actif ; toujours « production » pour un non-administrateur. */
  space: Space;
  /** Le compte au nom duquel on agit : la personne elle-même, ou le compte fictif joué en démo. */
  actor: AccountSummary;
  /** Vrai si la personne peut basculer d'espace (administrateur en production). */
  canSwitchSpace: boolean;
}

/** Corps de POST /api/space. */
export interface SpaceSwitch {
  space: Space;
  /** Compte fictif à jouer en démonstration ; par défaut, le premier administrateur fictif. */
  personaId?: number;
}

/** Un compte dans la liste d'administration. */
export interface UserRow extends AccountSummary {
  managerId: number | null;
  active: boolean;
  lastLoginAt: string | null;
  /** Sans connexion depuis plus que la durée paramétrée (données personnelles). */
  dormant: boolean;
}

/** Corps de PATCH /api/users/:id. */
export interface UserUpdate {
  role?: Role;
  managerId?: number | null;
}
