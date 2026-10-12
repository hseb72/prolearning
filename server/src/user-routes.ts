import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { UserRow } from '../../shared/auth.js';
import { hasRole, ROLES } from '../../shared/roles.js';
import { audit } from './audit.js';
import { requireRole } from './context.js';
import { findUser, listUsers, setManager, setRole, toRow } from './users.js';

const idParam = z.object({ id: z.coerce.number().int().positive() });
const updateBody = z
  .object({
    role: z.enum(ROLES).optional(),
    managerId: z.number().int().positive().nullable().optional(),
  })
  .refine((body) => body.role !== undefined || body.managerId !== undefined);

/**
 * Gestion des rôles et des rattachements (RBAC tenu dans l'application). Réservée aux
 * administrateurs ; agit sur la base de l'espace actif, et seulement elle.
 */
export function registerUserRoutes(app: FastifyInstance): void {
  app.get(
    '/api/users',
    { preHandler: requireRole('admin') },
    async (request): Promise<UserRow[]> => {
      return (await listUsers(request.auth!.db)).map(toRow);
    },
  );

  app.patch('/api/users/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const ctx = request.auth!;
    const params = idParam.safeParse(request.params);
    const body = updateBody.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ error: 'invalid', message: 'Modification invalide.' });
    }
    const target = await findUser(ctx.db, params.data.id);
    if (!target)
      return reply.code(404).send({ error: 'not_found', message: 'Compte introuvable.' });

    const { role, managerId } = body.data;
    if (role !== undefined && target.id === ctx.actor.id && role !== 'admin') {
      return reply.code(409).send({
        error: 'self_demotion',
        message: 'Vous ne pouvez pas retirer votre propre rôle d’administrateur.',
      });
    }
    if (managerId !== undefined && managerId !== null) {
      if (managerId === target.id) {
        return reply.code(409).send({
          error: 'own_manager',
          message: 'Un compte ne peut pas être son propre manager.',
        });
      }
      const manager = await findUser(ctx.db, managerId);
      if (!manager || !manager.active || !hasRole(manager.role, 'manager')) {
        return reply.code(409).send({
          error: 'invalid_manager',
          message: 'Le manager choisi n’a pas le rôle de manager.',
        });
      }
    }

    const actor = { actorId: ctx.actor.id, actorLabel: ctx.actor.email };
    if (role !== undefined && role !== target.role) {
      await setRole(ctx.db, target.id, role);
      await audit(ctx.db, {
        ...actor,
        action: 'user.role',
        details: { userId: target.id, from: target.role, to: role },
      });
    }
    if (managerId !== undefined && managerId !== target.managerId) {
      await setManager(ctx.db, target.id, managerId);
      await audit(ctx.db, {
        ...actor,
        action: 'user.manager',
        details: { userId: target.id, from: target.managerId, to: managerId },
      });
    }
    return toRow((await findUser(ctx.db, target.id))!);
  });
}
