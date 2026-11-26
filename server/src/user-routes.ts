import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import type { UserRow } from '../../shared/auth.js';
import { hasRole, ROLES } from '../../shared/roles.js';
import { audit } from './audit.js';
import { exportManagers, importManagers } from './manager-import.js';
import { requireRole } from './context.js';
import { getRetention } from './privacy.js';
import { findUser, listUsers, setManager, setRole, toRow } from './users.js';

const idParam = z.object({ id: z.coerce.number().int().positive() });
const updateBody = z
  .object({
    role: z.enum(ROLES).optional(),
    managerId: z.number().int().positive().nullable().optional(),
  })
  .refine((body) => body.role !== undefined || body.managerId !== undefined);
const importBody = z.object({
  contenu: z.string().max(1_000_000),
  appliquer: z.boolean(),
});

/**
 * Gestion des rôles et des rattachements (RBAC tenu dans l'application). Réservée aux
 * administrateurs ; agit sur la base de l'espace actif, et seulement elle.
 */
export function registerUserRoutes(app: FastifyInstance): void {
  app.get(
    '/api/users',
    { preHandler: requireRole('admin') },
    async (request): Promise<UserRow[]> => {
      const db = request.auth!.db;
      const { inactiveMonths } = await getRetention(db);
      return (await listUsers(db)).map((user) => toRow(user, inactiveMonths));
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
      if (await isUnder(ctx.db, managerId, target.id)) {
        return reply.code(409).send({
          error: 'manager_cycle',
          message: `${manager.displayName} est déjà dans l’équipe de ${target.displayName} : ce rattachement ferait une boucle.`,
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
    const { inactiveMonths } = await getRetention(ctx.db);
    return toRow((await findUser(ctx.db, target.id))!, inactiveMonths);
  });

  /** Rattachements actuels, en CSV : sert aussi de modèle pour l'import. */
  app.get(
    '/api/users/rattachements.csv',
    { preHandler: requireRole('admin') },
    async (request, reply) => {
      const csv = await exportManagers(request.auth!.db);
      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', 'attachment; filename="rattachements.csv"')
        .send(csv);
    },
  );

  /** Import CSV des rattachements : vérification, puis application (tout ou rien). */
  app.post(
    '/api/users/rattachements',
    { preHandler: requireRole('admin'), bodyLimit: 2 * 1024 * 1024 },
    async (request, reply) => {
      const body = importBody.safeParse(request.body);
      if (!body.success) {
        return reply
          .code(400)
          .send({ error: 'invalid', message: 'Fichier absent ou trop volumineux (1 Mo au plus).' });
      }
      const ctx = request.auth!;
      const report = await importManagers(ctx.db, body.data.contenu, body.data.appliquer, {
        actorId: ctx.actor.id,
        actorLabel: ctx.actor.email,
      });
      return reply.code(body.data.appliquer && !report.applied ? 422 : 200).send(report);
    },
  );
}

/** Vrai si `id` est sous l'autorité de `bossId`, directement ou par ses managers. */
async function isUnder(db: pg.Pool, id: number, bossId: number): Promise<boolean> {
  const res = await db.query<{ found: boolean }>(
    `WITH RECURSIVE chain(id, depth) AS (
       SELECT manager_id, 1 FROM pl_users WHERE id = $1
       UNION ALL
       SELECT u.manager_id, c.depth + 1 FROM pl_users u JOIN chain c ON u.id = c.id
        WHERE c.depth < 1000
     )
     SELECT EXISTS (SELECT 1 FROM chain WHERE id = $2) AS found`,
    [id, bossId],
  );
  return res.rows[0]!.found;
}
