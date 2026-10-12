import { TIME_ZONE } from '@shared/catalog';

/**
 * Dates des sessions : affichées et saisies à l'heure de Paris, quel que soit le fuseau du
 * poste (une session sur site a lieu à une heure locale, pas à une heure du navigateur).
 */

const parts = (date: Date) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TIME_ZONE,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

/** Écart (ms) entre l'heure de Paris et UTC à cet instant. */
function offset(date: Date): number {
  const p = parts(date);
  const asUtc = Date.UTC(+p['year']!, +p['month']! - 1, +p['day']!, +p['hour']!, +p['minute']!);
  return asUtc - Math.floor(date.getTime() / 60000) * 60000;
}

/** Valeur d'un champ `datetime-local` (heure de Paris) → date ISO. */
export function parisLocalToIso(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) throw new Error(`Date invalide : ${value}`);
  const naive = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!);
  // Deux passes : l'écart dépend de l'instant (changement d'heure).
  let utc = naive - offset(new Date(naive));
  utc = naive - offset(new Date(utc));
  return new Date(utc).toISOString();
}

/** Date ISO → valeur d'un champ `datetime-local` à l'heure de Paris. */
export function isoToParisLocal(iso: string): string {
  const p = parts(new Date(iso));
  return `${p['year']}-${p['month']}-${p['day']}T${p['hour']}:${p['minute']}`;
}

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
