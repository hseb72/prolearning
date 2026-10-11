import Fastify, { type FastifyInstance } from 'fastify';
import type { HealthReport } from '../../shared/health.js';
import { SPACES } from '../../shared/spaces.js';
import type { Databases } from './databases.js';

export interface AppOptions {
  databases: Databases;
  logLevel?: string;
}

/** Délai au-delà duquel une base est considérée comme injoignable par la sonde. */
const HEALTH_TIMEOUT_MS = 2000;

export function buildApp({ databases, logLevel = 'info' }: AppOptions): FastifyInstance {
  const app = Fastify({
    logger: { level: logLevel },
    // Derrière ingress-nginx puis Kong : l'adresse du client est dans X-Forwarded-For.
    trustProxy: true,
  });

  // Sonde de vie et de disponibilité (chart `app` : api.healthPath). Elle vérifie la
  // base de chaque espace : une API qui n'en joint qu'une n'est pas en état de servir.
  app.get('/api/health', async (_request, reply) => {
    const checks = await Promise.all(
      SPACES.map(async (space) => {
        try {
          await withTimeout(databases[space].query('SELECT 1'), HEALTH_TIMEOUT_MS);
          return [space, 'ok'] as const;
        } catch {
          return [space, 'unreachable'] as const;
        }
      }),
    );
    const report: HealthReport = {
      status: checks.every(([, state]) => state === 'ok') ? 'ok' : 'degraded',
      databases: Object.fromEntries(checks) as HealthReport['databases'],
    };
    return reply.code(report.status === 'ok' ? 200 : 503).send(report);
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ error: 'not_found', message: 'Ressource introuvable.' }),
  );

  return app;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('délai dépassé')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
