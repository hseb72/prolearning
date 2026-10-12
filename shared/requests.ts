/**
 * Demandes (étape 5) : inscriptions aux sessions en direct (validation du manager, puis
 * confirmation par l'équipe formation) et sessions sur mesure demandées par un manager.
 */

import type { Modalite } from './catalog.js';

export const REGISTRATION_STATUSES = [
  'attente_manager',
  'attente_formation',
  'confirmee',
  'refusee',
  'annulee',
] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

/** Statuts d'une demande d'inscription encore en cours (elle bloque une nouvelle demande). */
export const ACTIVE_REGISTRATION: readonly RegistrationStatus[] = [
  'attente_manager',
  'attente_formation',
  'confirmee',
];

export const CUSTOM_STATUSES = ['a_traiter', 'en_cours', 'acceptee', 'refusee', 'annulee'] as const;
export type CustomStatus = (typeof CUSTOM_STATUSES)[number];

/** Une demande sur mesure n'évolue plus une fois acceptée, refusée ou annulée. */
export const OPEN_CUSTOM: readonly CustomStatus[] = ['a_traiter', 'en_cours'];

export type CustomModalite = Modalite | 'indifferent';

export interface RequestEvent {
  date: string;
  statut: string;
  par: string;
  commentaire: string;
}

export interface RegistrationRequestView {
  id: number;
  statut: RegistrationStatus;
  motif: string;
  createdAt: string;
  demandeur: { id: number; displayName: string; email: string };
  session: {
    id: number;
    courseId: string;
    courseTitre: string;
    modalite: Modalite;
    debut: string;
    fin: string;
    lieu: string;
    places: number;
    placesRestantes: number;
    annulee: boolean;
  };
  historique: RequestEvent[];
}

export interface CustomRequestView {
  id: number;
  statut: CustomStatus;
  createdAt: string;
  demandeur: { id: number; displayName: string; email: string };
  courseId: string | null;
  courseTitre: string | null;
  sujet: string;
  modalite: CustomModalite;
  participants: number;
  periode: string;
  details: string;
  historique: RequestEvent[];
}

export interface MyRequests {
  inscriptions: RegistrationRequestView[];
  surMesure: CustomRequestView[];
}

/** Ce que voit un manager : les demandes de son équipe (collaborateurs rattachés). */
export interface TeamRequests {
  aValider: RegistrationRequestView[];
  recentes: RegistrationRequestView[];
}

/** Ce que traite l'équipe formation. */
export interface TrainingQueue {
  inscriptions: RegistrationRequestView[];
  surMesure: CustomRequestView[];
}

export interface RegistrationCreate {
  sessionId: number;
  motif?: string;
}

export interface CustomCreate {
  courseId: string | null;
  sujet: string;
  modalite: CustomModalite;
  participants: number;
  periode: string;
  details: string;
}

export interface Decision {
  decision: 'accepter' | 'refuser';
  commentaire?: string;
}

export interface CustomProcessing {
  statut: Exclude<CustomStatus, 'a_traiter' | 'annulee'>;
  commentaire?: string;
}
