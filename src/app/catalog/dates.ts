import { TIME_ZONE } from '@shared/catalog';

/**
 * Dates des sessions : affichées et saisies à l'heure de Paris, quel que soit le fuseau du
 * poste (une session sur site a lieu à une heure locale, pas à une heure du navigateur).
 */

export { isoToParisLocal, parisLocalToIso } from '@shared/paris-time';

const dayFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
});
const monthFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TIME_ZONE,
  month: 'long',
  year: 'numeric',
});

const sameDay = (a: Date, b: Date) => dayFormat.format(a) === dayFormat.format(b);

/** « mardi 14 octobre 2026, 09:00 – 12:30 », ou « du … au … » sur plusieurs jours. */
export function formatRange(debutIso: string, finIso: string): string {
  const debut = new Date(debutIso);
  const fin = new Date(finIso);
  if (sameDay(debut, fin)) {
    return `${dayFormat.format(debut)}, ${timeFormat.format(debut)} – ${timeFormat.format(fin)}`;
  }
  return `du ${dayFormat.format(debut)}, ${timeFormat.format(debut)}, au ${dayFormat.format(fin)}, ${timeFormat.format(fin)}`;
}

export function formatDay(iso: string): string {
  return dayFormat.format(new Date(iso));
}

/** « octobre 2026 », pour regrouper l'agenda par mois. */
export function formatMonth(iso: string): string {
  return monthFormat.format(new Date(iso));
}

const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** « 12 octobre 2026 à 14:30 », pour l'historique des demandes. */
export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

const isoDayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const shortDayFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** « 16 novembre 2026 », pour les lignes de session. */
export function formatDate(iso: string): string {
  return shortDayFormat.format(new Date(iso));
}

/**
 * Durée d'une session, en jours de calendrier à Paris : 0 pour une demi-journée (4 h 30 au
 * plus le même jour), sinon le nombre de jours couverts.
 */
export function sessionDays(debutIso: string, finIso: string): number {
  const debut = new Date(debutIso);
  const fin = new Date(finIso);
  const day = (d: Date) => Date.parse(`${isoDayFormat.format(d)}T00:00:00Z`);
  const days = Math.round((day(fin) - day(debut)) / 86_400_000) + 1;
  if (days === 1 && fin.getTime() - debut.getTime() <= 4.5 * 3_600_000) return 0;
  return days;
}
