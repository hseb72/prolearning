import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import { MAX_FORMATION_BYTES } from '../../shared/format.js';
import type { HealthReport } from '../../shared/health.js';
import { SPACES } from '../../shared/spaces.js';
import { registerAuthRoutes, type AuthSettings } from './auth/routes.js';
import { registerCatalogRoutes } from './catalog-routes.js';
import { resolveContext, sessionToken } from './context.js';
import type { Databases } from './databases.js';
import { registerFormationRoutes } from './formation-routes.js';
import { registerLearningRoutes } from './learning-routes.js';
import { registerPublicationRoutes } from './publication.js';
import { registerSpaceRoutes } from './space-routes.js';
import { registerUserRoutes } from './user-routes.js';

export interface AppOptions {
  databases: Databases;
  auth: AuthSettings;
  logLevel?: string;
}

/** Délai au-delà duquel une base est considérée comme injoignable par la sonde. */
const HEALTH_TIMEOUT_MS = 2000;

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function buildApp({ databases, auth, logLevel = 'info' }: AppOptions): FastifyInstance {
  const app = Fastify({
    logger: { level: logLevel },
    // Derrière ingress-nginx puis Kong : l'adresse du client est dans X-Forwarded-For.
    trustProxy: true,
  });
  app.register(cookie);
  // Dépôt de fichiers (formations) : le corps brut, pour valider l'encodage et garder
  // le texte exact (export sans perte). 10 Mo au plus (§ 1 du format), plus une marge
  // pour que le dépassement soit signalé par la validation, avec un message clair.
  app.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer', bodyLimit: MAX_FORMATION_BYTES + 1024 },
    (_request, body, done) => done(null, body),
  );
  app.decorateRequest('auth', null);

  // Défense contre les requêtes intersites : le cookie est SameSite=Lax, et une requête
  // qui modifie quelque chose doit, si elle annonce son origine, venir du front.
  const appOrigin = new URL(auth.appUrl).origin;
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (UNSAFE_METHODS.has(request.method) && origin && origin !== appOrigin) {
      return reply.code(403).send({ error: 'forbidden', message: 'Origine non autorisée.' });
    }
  });

  // Chaque requête est rattachée à sa session, donc à son espace (cf. context.ts).
  app.addHook('preHandler', async (request) => {
    request.auth = await resolveContext(databases, sessionToken(request));
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

  registerAuthRoutes(app, databases, auth);
  registerSpaceRoutes(app, databases);
  registerUserRoutes(app);
  registerFormationRoutes(app);
  registerPublicationRoutes(app, databases);
  registerLearningRoutes(app);
  registerCatalogRoutes(app);

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
