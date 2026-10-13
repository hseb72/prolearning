import type { RegistrationStatus } from './requests.js';

/**
 * Catalogue et sessions (étape 4) : ce que l'interface et l'API se partagent.
 * Fiches et sessions sont propres à chaque espace (une base par espace).
 */

export const MODALITES = ['distance', 'site'] as const;
export type Modalite = (typeof MODALITES)[number];

/** Façons de suivre une formation, pour filtrer le catalogue. */
export type Format = Modalite | 'en-ligne';

/** Identifiant de fiche : un slug, comme les identifiants du format d'échange. */
export const COURSE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface SessionView {
  id: number;
  courseId: string;
  courseTitre: string;
  modalite: Modalite;
  /** Dates ISO 8601. */
  debut: string;
  fin: string;
  lieu: string;
  formateur: string;
  places: number;
  placesRestantes: number;
  annulee: boolean;
}

export interface CourseCard {
  id: string;
  titre: string;
  theme: string;
  resume: string;
  dureeHeures: number | null;
  /** Parcours en ligne associé, s'il est disponible dans l'espace. */
  formationId: string | null;
  /** Façons de suivre la formation : sessions à venir et parcours en ligne. */
  formats: Format[];
  /** Début de la prochaine session ouverte, s'il y en a une. */
  prochaineSession: string | null;
  publiee: boolean;
  /**
   * Parcours en ligne publié sans fiche du catalogue : la carte mène directement au
   * parcours (`/parcours/:formationId`), il n'y a ni fiche ni session.
   */
  parcoursSeul: boolean;
}

export interface CourseDetail extends CourseCard {
  objectifs: string[];
  public: string;
  prerequis: string;
  /** Sessions à venir ; l'équipe formation voit aussi les sessions passées et annulées. */
  sessions: SessionView[];
  /** Demandes d'inscription en cours de la personne, par identifiant de session. */
  mesDemandes: Record<number, { id: number; statut: RegistrationStatus }>;
}

/** Fiche saisie par l'équipe formation. */
export interface CourseInput {
  id: string;
  titre: string;
  theme: string;
  resume: string;
  objectifs: string[];
  public: string;
  prerequis: string;
  dureeHeures: number | null;
  formationId: string | null;
  publiee: boolean;
}

/** Session saisie par l'équipe formation. */
export interface SessionInput {
  modalite: Modalite;
  debut: string;
  fin: string;
  lieu: string;
  formateur: string;
  places: number;
}

/** Parcours en ligne disponibles, à associer à une fiche. */
export interface FormationOption {
  id: string;
  titre: string;
}

/** Dates et heures affichées à l'heure de Paris, quel que soit le poste. */
export const TIME_ZONE = 'Europe/Paris';
