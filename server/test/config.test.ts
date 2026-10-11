import { loadConfig } from '../src/config.js';

const base = {
  DATABASE_URL_PRODUCTION: 'postgres://prolearning:x@localhost:5432/prolearning',
  DATABASE_URL_DEMO: 'postgres://prolearning-demo:x@localhost:5432/prolearning_demo',
};

describe('configuration', () => {
  it('applique les valeurs par défaut', () => {
    const config = loadConfig(base);
    expect(config.PORT).toBe(5080);
    expect(config.NODE_ENV).toBe('development');
  });

  it('exige l’adresse de la base de chaque espace', () => {
    expect(() => loadConfig({ DATABASE_URL_PRODUCTION: base.DATABASE_URL_PRODUCTION })).toThrow(
      /DATABASE_URL_DEMO/,
    );
    expect(() => loadConfig({ DATABASE_URL_DEMO: base.DATABASE_URL_DEMO })).toThrow(
      /DATABASE_URL_PRODUCTION/,
    );
  });

  it('refuse que les deux espaces désignent la même base', () => {
    expect(() => loadConfig({ ...base, DATABASE_URL_DEMO: base.DATABASE_URL_PRODUCTION })).toThrow(
      /même base/,
    );
  });
});
