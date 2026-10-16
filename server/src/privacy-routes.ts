import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { RETENTION_BOUNDS, type RetentionSettings } from '../../shared/privacy.js';
import { SESSION_COOKIE } from './auth/sessions.js';
import { audit } from './audit.js';
import { requireRole } from './context.js';
import {
  DELETED_ACTOR,
  deleteUserData,
  exportUserData,
  getPlatform,
  getRetention,
  isLastAdmin,
  setPlatform,
  setRetention,
} from './privacy.js';
import { findUser } from './users.js';

const idParam = z.object({ id: z.coerce.number().int().positive() });
const bound = (key: keyof RetentionSettings) =>
  z.number().int().min(RETENTION_BOUNDS[key].min).max(RETENTION_BOUNDS[key].max);
const platformBody = z.object({ publique: z.boolean() });
const retentionBody = z.object({
  requestsMonths: bound('requestsMonths'),
  auditMonths: bound('auditMonths'),
  inactiveMonths: bound('inactiveMonths'),
});

/** Réponse JSON à télécharger : `mes-donnees-<date>.json`. */
function sendExport(reply: FastifyReply, data: Record<string, unknown>, name: string) {
  const day = new Date().toISOString().slice(0, 10);
  return reply
    .header('content-type', 'application/json; charset=utf-8')
    .header('content-disposition', `attachment; filename="${name}-${day}.json"`)
    .header('cache-control', 'no-store')
    .send(JSON.stringify(data, null, 2));
}

/**
 * Données personnelles : chacun exporte les siennes ; un administrateur exporte ou supprime
 * celles d'un compte et règle les durées de conservation. Tout agit sur la base de l'espace
 * actif, et seulement elle.
 */
export function registerPrivacyRoutes(app: FastifyInstance): void {
  app.get('/api/moi/donnees', async (request, reply) => {
    const ctx = request.auth;
    if (!ctx)
      return reply.code(401).send({ error: 'unauthenticated', message: 'Connexion requise.' });
    const data = await exportUserData(ctx.db, ctx.actor.id);
    return sendExport(reply, data!, 'mes-donnees');
  });

  app.get(
    '/api/users/:id/donnees',
    { preHandler: requireRole('admin') },
    async (request, reply) => {
      const params = idParam.safeParse(request.params);
      if (!params.success)
        return reply.code(400).send({ error: 'invalid', message: 'Compte invalide.' });
      const data = await exportUserData(request.auth!.db, params.data.id);
      if (!data)
        return reply.code(404).send({ error: 'not_found', message: 'Compte introuvable.' });
      return sendExport(reply, data, `donnees-compte-${params.data.id}`);
    },
  );

  app.delete('/api/users/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const ctx = request.auth!;
    const params = idParam.safeParse(request.params);
    if (!params.success)
      return reply.code(400).send({ error: 'invalid', message: 'Compte invalide.' });
    const target = await findUser(ctx.db, params.data.id);
    if (!target)
      return reply.code(404).send({ error: 'not_found', message: 'Compte introuvable.' });
    // Pas son propre compte (en démonstration : pas le compte qu'on est en train de jouer).
    if (target.id === ctx.actor.id) {
      return reply.code(409).send({
        error: 'self_delete',
        message: 'Vous ne pouvez pas supprimer votre propre compte.',
      });
    }
    await deleteUserData(ctx.db, target.id);
    await audit(ctx.db, {
      actorId: ctx.actor.id,
      actorLabel: ctx.actor.email,
      action: 'user.delete',
      // Ni nom ni e-mail : la personne demande l'effacement de ses données.
      details: { userId: target.id },
    });
    return reply.code(204).send();
  });

  /**
   * Plateforme publique seulement : chacun supprime son compte et ses données de l'espace
   * actif. En production, la connexion part avec le compte ; en démonstration, l'administrateur
   * supprime le compte fictif qu'il joue et reprend le compte fictif par défaut.
   */
  app.delete('/api/moi', async (request, reply) => {
    const ctx = request.auth;
    if (!ctx)
      return reply.code(401).send({ error: 'unauthenticated', message: 'Connexion requise.' });
    if (!(await getPlatform(ctx.db)).publique) {
      return reply.code(403).send({
        error: 'internal_platform',
        message: 'Plateforme interne : demandez la suppression à un administrateur.',
      });
    }
    if (await isLastAdmin(ctx.db, ctx.actor.id)) {
      return reply.code(409).send({
        error: 'last_admin',
        message:
          'Vous êtes le dernier administrateur : nommez-en un autre avant de supprimer votre compte.',
      });
    }
    await deleteUserData(ctx.db, ctx.actor.id);
    await audit(ctx.db, {
      actorId: null,
      actorLabel: DELETED_ACTOR,
      action: 'user.delete',
      details: { userId: ctx.actor.id, parLuiMeme: true },
    });
    const signedOut = ctx.space === 'production';
    if (signedOut) reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { deconnecte: signedOut };
  });

  // Lisible par tous : « Mes données » montre le bouton ou le message selon l'ouverture.
  app.get('/api/parametres/plateforme', async (request, reply) => {
    if (!request.auth)
      return reply.code(401).send({ error: 'unauthenticated', message: 'Connexion requise.' });
    return getPlatform(request.auth.db);
  });

  app.put(
    '/api/parametres/plateforme',
    { preHandler: requireRole('admin') },
    async (request, reply) => {
      const ctx = request.auth!;
      const body = platformBody.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'invalid', message: 'Paramètre invalide.' });
      }
      const before = await getPlatform(ctx.db);
      await setPlatform(ctx.db, body.data, ctx.actor.id);
      await audit(ctx.db, {
        actorId: ctx.actor.id,
        actorLabel: ctx.actor.email,
        action: 'settings.platform',
        details: {
          from: before.publique ? 'publique' : 'interne',
          to: body.data.publique ? 'publique' : 'interne',
        },
      });
      return body.data;
    },
  );

  // Lisible par tous (« Mes données ») : chacun sait combien de temps ses données sont gardées.
  app.get('/api/parametres/conservation', async (request, reply) => {
    if (!request.auth)
      return reply.code(401).send({ error: 'unauthenticated', message: 'Connexion requise.' });
    return getRetention(request.auth.db);
  });

  app.put(
    '/api/parametres/conservation',
    { preHandler: requireRole('admin') },
    async (request, reply) => {
      const ctx = request.auth!;
      const body = retentionBody.safeParse(request.body);
      if (!body.success) {
        return reply
          .code(400)
          .send({ error: 'invalid', message: 'Durées de conservation invalides.' });
      }
      const before = await getRetention(ctx.db);
      await setRetention(ctx.db, body.data, ctx.actor.id);
      await audit(ctx.db, {
        actorId: ctx.actor.id,
        actorLabel: ctx.actor.email,
        action: 'settings.retention',
        details: { from: before, to: body.data },
      });
      return body.data;
    },
  );
}
