import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AUDIT_FAMILIES, type AuditPage } from '../../shared/audit.js';
import { requireRole } from './context.js';

const PAGE_SIZE = 50;

const query = z.object({
  famille: z.enum(AUDIT_FAMILIES).optional(),
  avant: z.coerce.number().int().positive().optional(),
});

/**
 * Journal d'audit de l'espace actif, réservé aux administrateurs. Lecture seule, par pages
 * de 50, du plus récent au plus ancien ; filtre facultatif par famille d'actions.
 */
export function registerJournalRoutes(app: FastifyInstance): void {
  app.get(
    '/api/journal',
    { preHandler: requireRole('admin') },
    async (request, reply): Promise<AuditPage | void> => {
      const params = query.safeParse(request.query);
      if (!params.success) {
        return reply.code(400).send({ error: 'invalid', message: 'Filtre du journal invalide.' });
      }
      const { famille, avant } = params.data;
      // « login » et « logout » sont des actions entières ; les autres, des préfixes (« user.role »).
      const pattern =
        famille === undefined
          ? null
          : famille === 'login' || famille === 'logout'
            ? famille
            : `${famille}.%`;
      const rows = await request.auth!.db.query<{
        id: string;
        occurred_at: Date;
        actor_label: string | null;
        action: string;
        details: Record<string, unknown>;
      }>(
        `SELECT id, occurred_at, actor_label, action, details FROM pl_audit_log
          WHERE ($1::text IS NULL OR action LIKE $1)
            AND ($2::bigint IS NULL OR id < $2)
          ORDER BY id DESC
          LIMIT $3`,
        [pattern, avant ?? null, PAGE_SIZE + 1],
      );
      const page = rows.rows.slice(0, PAGE_SIZE);
      return {
        entries: page.map((r) => ({
          id: Number(r.id),
          occurredAt: r.occurred_at.toISOString(),
          actorLabel: r.actor_label,
          action: r.action,
          details: r.details,
        })),
        next: rows.rows.length > PAGE_SIZE ? Number(page.at(-1)!.id) : null,
      };
    },
  );
}
