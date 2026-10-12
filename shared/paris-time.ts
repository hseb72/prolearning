import { TIME_ZONE } from './catalog.js';

/**
 * Conversion entre l'heure de Paris (saisie des sessions, jeux de démonstration) et les
 * dates ISO, sans bibliothèque : le fuseau est lu par Intl, changements d'heure compris.
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
