import { loadConfig } from '../src/config.js';

const base = {
  DATABASE_URL_PRODUCTION: 'postgres://prolearning:x@localhost:5432/prolearning',
  DATABASE_URL_DEMO: 'postgres://prolearning-demo:x@localhost:5432/prolearning_demo',
  AUTH_DEV_LOGIN: 'true',
};

const sso = {
  OIDC_ISSUER: 'https://sso.crealcs.com/realms/soredi',
  OIDC_CLIENT_ID: 'prolearning',
  OIDC_CLIENT_SECRET: 'secret',
};

const production = {
  DATABASE_URL_PRODUCTION: base.DATABASE_URL_PRODUCTION,
  DATABASE_URL_DEMO: base.DATABASE_URL_DEMO,
  NODE_ENV: 'production',
  APP_URL: 'https://prolearning.crealcs.com',
  ...sso,
};

describe('configuration', () => {
  it('applique les valeurs par défaut', () => {
    const config = loadConfig(base);
    expect(config.PORT).toBe(5080);
    expect(config.NODE_ENV).toBe('development');
    expect(config.SESSION_DAYS).toBe(7);
    expect(config.oidc).toBeNull();
  });

  it('exige l’adresse de la base de chaque espace', () => {
    const { DATABASE_URL_DEMO: _demo, ...withoutDemo } = base;
    const { DATABASE_URL_PRODUCTION: _prod, ...withoutProduction } = base;
    expect(() => loadConfig(withoutDemo)).toThrow(/DATABASE_URL_DEMO/);
    expect(() => loadConfig(withoutProduction)).toThrow(/DATABASE_URL_PRODUCTION/);
  });

  it('refuse que les deux espaces désignent la même base', () => {
    expect(() => loadConfig({ ...base, DATABASE_URL_DEMO: base.DATABASE_URL_PRODUCTION })).toThrow(
      /même base/,
    );
  });

  it('exige au moins un mode de connexion', () => {
    expect(() => loadConfig({ ...base, AUTH_DEV_LOGIN: 'false' })).toThrow(
      /aucun mode de connexion/,
    );
  });

  it('lit le SSO Keycloak et les administrateurs d’amorçage', () => {
    const config = loadConfig({
      ...base,
      ...sso,
      BOOTSTRAP_ADMIN_EMAILS: ' Admin@Soredi.example , autre@soredi.example,',
    });
    expect(config.oidc).toEqual({
      issuer: 'https://sso.crealcs.com/realms/soredi',
      clientId: 'prolearning',
      clientSecret: 'secret',
    });
    expect(config.BOOTSTRAP_ADMIN_EMAILS).toEqual(['admin@soredi.example', 'autre@soredi.example']);
  });

  it('refuse un SSO à moitié configuré', () => {
    expect(() => loadConfig({ ...base, OIDC_ISSUER: sso.OIDC_ISSUER })).toThrow(/vont ensemble/);
  });

  it('accepte une configuration de production complète', () => {
    expect(loadConfig(production).oidc?.clientId).toBe('prolearning');
  });

  it('interdit en production la connexion de développement, l’absence de SSO et le http', () => {
    expect(() => loadConfig({ ...production, AUTH_DEV_LOGIN: 'true' })).toThrow(/interdit/);
    const { OIDC_ISSUER: _i, OIDC_CLIENT_ID: _c, OIDC_CLIENT_SECRET: _s, ...noSso } = production;
    expect(() => loadConfig(noSso)).toThrow(/SSO/);
    expect(() => loadConfig({ ...production, APP_URL: 'http://prolearning.crealcs.com' })).toThrow(
      /https/,
    );
  });
});
