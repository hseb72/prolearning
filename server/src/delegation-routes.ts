import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { MyDelegations } from '../../shared/delegations.js';
import { requireAuth, requireRole } from './context.js';
import {
  delegateCandidates,
  delegationOf,
  delegationsTo,
  endDelegation,
  setDelegation,
} from './delegations.js';
import { findUser, type UserRecord } from './users.js';

const idParam = z.object({ id: z.coerce.number().int().positive() });
const updateBody = z.object({
  suppleantId: z.number().int().positive(),
  debut: z.string().max(10),
  fin: z.string().max(10),
});

/**
 * Suppléance (26 novembre 2026) : un manager désigne, pour une période, un collaborateur
 * qui valide en plus de lui les demandes d'inscription de son équipe. Un administrateur
 * peut le faire pour un manager absent. Tout se passe dans la base de l'espace actif.
 */
export function registerDelegationRoutes(app: FastifyInstance): void {
  const auth = { preHandler: requireAuth };
  const manager = { preHandler: requireRole('manager') };
  const admin = { preHandler: requireRole('admin') };

  async function save(
    reply: FastifyReply,
    db: Parameters<typeof setDelegation>[0],
    target: UserRecord,
    body: unknown,
    actor: UserRecord,
  ) {
    const parsed = updateBody.safeParse(body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid', message: 'Suppléance invalide.' });
    }
    const outcome = await setDelegation(db, target, parsed.data, actor);
    if ('refus' in outcome) {
      return reply.code(409).send({ error: 'conflict', message: outcome.refus });
    }
    return outcome.ok;
  }

  app.get('/api/suppleance', auth, async (request): Promise<MyDelegations> => {
    const ctx = request.auth!;
    return {
      maSuppleance: await delegationOf(ctx.db, ctx.actor.id),
      jeSupplee: await delegationsTo(ctx.db, ctx.actor.id),
    };
  });

  app.get('/api/suppleance/candidats', manager, async (request) => {
    const ctx = request.auth!;
    return delegateCandidates(ctx.db, ctx.actor.id);
  });

  app.put('/api/suppleance', manager, async (request, reply) => {
    const ctx = request.auth!;
    return save(reply, ctx.db, ctx.actor, request.body, ctx.actor);
  });

  app.delete('/api/suppleance', manager, async (request, reply) => {
    const ctx = request.auth!;
    await endDelegation(ctx.db, ctx.actor.id, ctx.actor);
    return reply.code(204).send();
  });

  // Administration : la suppléance d'un manager absent.
  const idOf = (params: unknown): number | null => {
    const p = idParam.safeParse(params);
    return p.success ? p.data.id : null;
  };

  app.get('/api/users/:id/suppleance', admin, async (request, reply) => {
    const ctx = request.auth!;
    const id = idOf(request.params);
    if (id === null) return reply.code(400).send({ error: 'invalid', message: 'Compte invalide.' });
    return {
      suppleance: await delegationOf(ctx.db, id),
      candidats: await delegateCandidates(ctx.db, id),
    };
  });

  app.put('/api/users/:id/suppleance', admin, async (request, reply) => {
    const ctx = request.auth!;
    const id = idOf(request.params);
    const user = id === null ? null : await findUser(ctx.db, id);
    if (!user) return reply.code(404).send({ error: 'not_found', message: 'Compte introuvable.' });
    return save(reply, ctx.db, user, request.body, ctx.actor);
  });

  app.delete('/api/users/:id/suppleance', admin, async (request, reply) => {
    const ctx = request.auth!;
    const id = idOf(request.params);
    if (id === null) return reply.code(400).send({ error: 'invalid', message: 'Compte invalide.' });
    await endDelegation(ctx.db, id, ctx.actor);
    return reply.code(204).send();
  });
}
