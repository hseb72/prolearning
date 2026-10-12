import { formatRange, isoToParisLocal, parisLocalToIso } from './dates';

describe('dates des sessions (heure de Paris)', () => {
  it('convertit une saisie en heure de Paris, été comme hiver', () => {
    expect(parisLocalToIso('2026-07-01T09:00')).toBe('2026-07-01T07:00:00.000Z');
    expect(parisLocalToIso('2026-12-01T09:00')).toBe('2026-12-01T08:00:00.000Z');
    // Lendemain du passage à l'heure d'hiver (25 octobre 2026).
    expect(parisLocalToIso('2026-10-26T09:30')).toBe('2026-10-26T08:30:00.000Z');
  });

  it('fait l’aller-retour vers le champ de saisie', () => {
    for (const value of ['2026-03-29T10:00', '2026-10-12T14:45', '2027-01-04T08:15']) {
      expect(isoToParisLocal(parisLocalToIso(value))).toBe(value);
    }
  });

  it('affiche une session d’un jour ou de plusieurs jours', () => {
    expect(formatRange('2026-10-13T07:00:00Z', '2026-10-13T10:30:00Z')).toBe(
      'mardi 13 octobre 2026, 09:00 – 12:30',
    );
    expect(formatRange('2026-10-13T07:00:00Z', '2026-10-14T15:00:00Z')).toBe(
      'du mardi 13 octobre 2026, 09:00, au mercredi 14 octobre 2026, 17:00',
    );
  });

  it('refuse une saisie mal formée', () => {
    expect(() => parisLocalToIso('13/10/2026')).toThrow();
  });
});
