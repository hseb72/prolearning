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
  /** Vrai si la personne s'est connectée par Keycloak : elle peut y changer son mot de passe. */
  sso: boolean;
  /** Vrai si le compte joué supplée aujourd'hui un manager : il voit « Mon équipe ». */
  suppleant: boolean;
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

/** Corps de POST /api/users/rattachements : fichier CSV à vérifier ou à appliquer. */
export interface ManagerImportRequest {
  /** Texte du fichier (séparateur « ; », « , » ou tabulation, avec une ligne d'en-tête). */
  contenu: string;
  /** Faux : vérification seule. Vrai : application, refusée s'il reste une erreur. */
  appliquer: boolean;
}

/** Issue d'une ligne du fichier de rattachements. */
export type ManagerImportStatus = 'created' | 'updated' | 'unchanged' | 'error';

export interface ManagerImportLine {
  /** Numéro de ligne dans le fichier (l'en-tête est la ligne 1). */
  line: number;
  member: string;
  manager: string | null;
  status: ManagerImportStatus;
  /** Manager avant l'import (adresse), pour une ligne modifiée. */
  previousManager?: string | null;
  message?: string;
}

/** Rapport de l'import : rien n'est appliqué tant qu'une ligne est en erreur. */
export interface ManagerImportReport {
  applied: boolean;
  lines: ManagerImportLine[];
  /** Comptes promus manager parce qu'un collaborateur leur est rattaché. */
  promoted: string[];
  counts: Record<ManagerImportStatus, number>;
  /** Erreur qui porte sur tout le fichier (en-tête, taille). */
  fileError?: string;
}
