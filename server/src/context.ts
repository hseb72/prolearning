import type { FastifyReply, FastifyRequest } from 'fastify';
import type pg from 'pg';
import { hasRole, type Role } from '../../shared/roles.js';
import type { Space } from '../../shared/spaces.js';
import { resolveSession, SESSION_COOKIE } from './auth/sessions.js';
import type { Databases } from './databases.js';
import { findDefaultPersona } from './demo.js';
import { findUser, type UserRecord } from './users.js';

/**
 * Contexte d'une requête authentifiée. C'est par lui, et lui seul, que les routes
 * métier atteignent une base : `db` est celle de l'espace actif, jamais l'autre.
 */
export interface RequestContext {
  token: string;
  /** La personne connectée, telle qu'enregistrée en production. */
  user: UserRecord;
  space: Space;
  db: pg.Pool;
  /** Le compte au nom duquel on agit : `user` en production, le compte joué en démo. */
  actor: UserRecord;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: RequestContext | null;
  }
}

/**
 * Résout la session. Règle d'isolation : seul un administrateur (rôle lu en base de
 * PRODUCTION) peut être servi par la démonstration ; pour tout autre compte, l'espace
 * enregistré dans la session est ignoré et la production s'applique.
 */
export async function resolveContext(
  databases: Databases,
  token: string | undefined,
): Promise<RequestContext | null> {
  if (!token) return null;
  const production = databases.production;
  const session = await resolveSession(production, token);
  if (!session) return null;
  const user = await findUser(production, session.userId);
  if (!user || !user.active) return null;

  if (user.role === 'admin' && session.activeSpace === 'demo') {
    const demo = databases.demo;
    const persona =
      (session.demoPersonaId !== null && (await findUser(demo, session.demoPersonaId))) ||
      (await findDefaultPersona(demo));
    if (persona) return { token, user, space: 'demo', db: demo, actor: persona };
  }
  return { token, user, space: 'production', db: production, actor: user };
}

export function sessionToken(request: FastifyRequest): string | undefined {
  return request.cookies[SESSION_COOKIE];
}

/** Garde : session valide exigée. */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.auth) {
    await reply.code(401).send({ error: 'unauthenticated', message: 'Connexion requise.' });
  }
}

/** Garde : rôle minimal exigé, évalué sur le compte au nom duquel on agit. */
export function requireRole(role: Role) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.auth) {
      await reply.code(401).send({ error: 'unauthenticated', message: 'Connexion requise.' });
    } else if (!hasRole(request.auth.actor.role, role)) {
      await reply.code(403).send({ error: 'forbidden', message: 'Accès non autorisé.' });
    }
  };
}
