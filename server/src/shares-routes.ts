import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import {
  SHARE_VISIBILITIES,
  type SharedAchievement,
  type ShareVisibility,
} from '../../shared/learning.js';
import { requireAuth, requireRole } from './context.js';
import { allCurrentFormations, currentFormation, type RawFormation } from './learning/content.js';
import { formationProgress, learnerProfile } from './learning/progress.js';

const formationParam = z.object({ formation: z.string().min(1).max(64) });
const shareBody = z.object({ visibilite: z.enum(SHARE_VISIBILITIES) });

interface ShareRow {
  user_id: string;
  display_name: string;
  formation_id: string;
  visibility: 'manager' | 'communaute';
  updated_at: Date;
}

/** Compose les réussites publiées : progression du parcours, niveau et badges de la personne. */
async function achievements(db: pg.Pool, rows: ShareRow[]): Promise<SharedAchievement[]> {
  if (!rows.length) return [];
  const formations = new Map<string, RawFormation>(
    (await allCurrentFormations(db)).map((f) => [f.id, f]),
  );
  const list = formations.size ? [...formations.values()] : [];
  const out: SharedAchievement[] = [];
  for (const row of rows) {
    const formation = formations.get(row.formation_id);
    if (!formation) continue; // parcours retiré : rien à montrer
    const userId = Number(row.user_id);
    const progress = await formationProgress(db, userId, formation);
    const modulesTermines = Object.values(progress.modules).filter((m) => m.termine).length;
    const profile = await learnerProfile(db, userId, list);
    out.push({
      personne: row.display_name,
      formationId: formation.id,
      formationTitre: formation['titre'] as string,
      modulesTermines,
      modulesTotal: formation.modules.length,
      termine: modulesTermines === formation.modules.length,
      niveau: profile.niveau.niveau.nom,
      badges: profile.badges,
      visibilite: row.visibility,
      publieLe: row.updated_at.toISOString(),
    });
  }
  return out;
}

const SELECT_SHARES = `SELECT s.user_id, u.display_name, s.formation_id, s.visibility, s.updated_at
  FROM pl_achievement_shares s JOIN pl_users u ON u.id = s.user_id`;

/**
 * Publication des réussites (décision 5) : l'apprenant choisit, parcours par parcours, qui
 * voit sa progression ; rien n'est publié sans son action. Le manager voit ce que son
 * équipe lui montre ; tous voient ce qui est publié pour tous.
 */
export function registerShareRoutes(app: FastifyInstance): void {
  app.get(
    '/api/parcours/:formation/partage',
    { preHandler: requireAuth },
    async (request, reply) => {
      const ctx = request.auth!;
      const params = formationParam.safeParse(request.params);
      if (!params.success)
        return reply.code(400).send({ error: 'invalid', message: 'Parcours invalide.' });
      const res = await ctx.db.query<{ visibility: ShareVisibility }>(
        'SELECT visibility FROM pl_achievement_shares WHERE user_id = $1 AND formation_id = $2',
        [ctx.actor.id, params.data.formation],
      );
      return { visibilite: res.rows[0]?.visibility ?? 'prive' };
    },
  );

  app.put(
    '/api/parcours/:formation/partage',
    { preHandler: requireAuth },
    async (request, reply) => {
      const ctx = request.auth!;
      const params = formationParam.safeParse(request.params);
      const body = shareBody.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply
          .code(400)
          .send({ error: 'invalid', message: 'Choix de publication invalide.' });
      }
      const formation = await currentFormation(ctx.db, params.data.formation);
      if (!formation)
        return reply.code(404).send({ error: 'not_found', message: 'Parcours introuvable.' });
      const { visibilite } = body.data;
      if (visibilite === 'prive') {
        await ctx.db.query(
          'DELETE FROM pl_achievement_shares WHERE user_id = $1 AND formation_id = $2',
          [ctx.actor.id, formation.id],
        );
        return { visibilite };
      }
      // Rien à montrer tant qu'aucun module n'est terminé.
      const progress = await formationProgress(ctx.db, ctx.actor.id, formation);
      if (!Object.values(progress.modules).some((m) => m.termine)) {
        return reply.code(409).send({
          error: 'nothing_to_share',
          message: 'Terminez au moins un module avant de publier votre réussite.',
        });
      }
      await ctx.db.query(
        `INSERT INTO pl_achievement_shares (user_id, formation_id, visibility) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, formation_id) DO UPDATE SET visibility = $3, updated_at = now()`,
        [ctx.actor.id, formation.id, visibilite],
      );
      return { visibilite };
    },
  );

  app.get('/api/reussites', { preHandler: requireAuth }, async (request) => {
    const db = request.auth!.db;
    const rows = await db.query<ShareRow>(
      `${SELECT_SHARES} WHERE s.visibility = 'communaute' AND u.active ORDER BY s.updated_at DESC`,
    );
    return achievements(db, rows.rows);
  });

  app.get('/api/equipe/reussites', { preHandler: requireRole('manager') }, async (request) => {
    const ctx = request.auth!;
    const rows = await ctx.db.query<ShareRow>(
      `${SELECT_SHARES} WHERE u.manager_id = $1 AND u.active ORDER BY u.display_name, s.updated_at DESC`,
      [ctx.actor.id],
    );
    return achievements(ctx.db, rows.rows);
  });
}
