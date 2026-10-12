import { DEFAULT_SPACE, isSpace, SPACES } from './spaces.js';

describe('espaces', () => {
  it('reconnaît les deux espaces et eux seuls', () => {
    expect(SPACES).toEqual(['production', 'demo']);
    expect(isSpace('production')).toBe(true);
    expect(isSpace('demo')).toBe(true);
    expect(isSpace('Production')).toBe(false);
    expect(isSpace('')).toBe(false);
    expect(isSpace(undefined)).toBe(false);
  });

  it('place la production par défaut', () => {
    expect(DEFAULT_SPACE).toBe('production');
  });
});
