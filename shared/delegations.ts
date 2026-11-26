/** Suppléance d'un manager (26 novembre 2026). */

export interface DelegationPerson {
  id: number;
  displayName: string;
  email: string;
}

/** État d'une suppléance par rapport à aujourd'hui (heure de Paris). */
export type DelegationState = 'a_venir' | 'en_cours';

export interface DelegationView {
  manager: DelegationPerson;
  suppleant: DelegationPerson;
  /** Premier et dernier jour, inclus (AAAA-MM-JJ, heure de Paris). */
  debut: string;
  fin: string;
  etat: DelegationState;
}

/** Réponse de GET /api/suppleance. */
export interface MyDelegations {
  /** La suppléance que j'ai prévue, en tant que manager (en cours ou à venir). */
  maSuppleance: DelegationView | null;
  /** Les managers que je supplée ou vais suppléer. */
  jeSupplee: DelegationView[];
}

/** Corps de PUT /api/suppleance et PUT /api/users/:id/suppleance. */
export interface DelegationUpdate {
  suppleantId: number;
  debut: string;
  fin: string;
}

/** Durée maximale d'une suppléance, en jours. */
export const MAX_DELEGATION_DAYS = 366;
