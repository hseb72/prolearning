import type pg from 'pg';
import { buildApp } from '../src/app.js';
import type { Databases } from '../src/databases.js';
import { AUTH } from './helpers.js';

function fakePool(reachable: boolean): pg.Pool {
  return {
    query: async () => {
      if (!reachable) throw new Error('connexion refusée');
      return { rows: [{ '?column?': 1 }] };
    },
  } as unknown as pg.Pool;
}

function databases(production: boolean, demo: boolean, evaluation = true): Databases {
  return {
    production: fakePool(production),
    demo: fakePool(demo),
    evaluation: fakePool(evaluation),
  };
}

describe('GET /api/health', () => {
  it('répond 200 quand les trois bases sont joignables', async () => {
    const app = buildApp({ databases: databases(true, true), logLevel: 'silent', auth: AUTH });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: 'ok',
      databases: { production: 'ok', demo: 'ok', evaluation: 'ok' },
    });
  });

  it('répond 503 et désigne la base injoignable', async () => {
    const app = buildApp({ databases: databases(true, false), logLevel: 'silent', auth: AUTH });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({
      status: 'degraded',
      databases: { production: 'ok', demo: 'unreachable', evaluation: 'ok' },
    });
  });

  it('répond en français sur une route inconnue', async () => {
    const app = buildApp({ databases: databases(true, true), logLevel: 'silent', auth: AUTH });
    const res = await app.inject({ method: 'GET', url: '/api/inconnue' });
    expect(res.statusCode).toBe(404);
    expect(res.json().message).toBe('Ressource introuvable.');
  });
});
