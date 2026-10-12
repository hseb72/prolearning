import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AccountSummary } from '../../shared/auth.js';
import { SPACES } from '../../shared/spaces.js';
import { audit } from './audit.js';
import { toMe } from './auth/routes.js';
import { setSessionSpace } from './auth/sessions.js';
import { resolveContext } from './context.js';
import type { Databases } from './databases.js';
import { findDefaultPersona } from './demo.js';
import { findUser, listUsers, toSummary } from './users.js';

const switchBody = z.object({
  space: z.enum(SPACES),
  personaId: z.number().int().positive().optional(),
});

/**
 * Bascule production/démonstration. Réservée aux administrateurs, d'après leur compte de
 * PRODUCTION : jouer un collaborateur en démo ne retire pas le droit de revenir.
 */
export function registerSpaceRoutes(app: FastifyInstance, databases: Databases): void {
  const isAdmin = (request: { auth: { user: { role: string } } | null }) =>
    request.auth?.user.role === 'admin';

  app.get('/api/space/personas', async (request, reply) => {
    if (!request.auth)
      return reply.code(401).send({ error: 'unauthenticated', message: 'Connexion requise.' });
    if (!isAdmin(request))
      return reply.code(403).send({ error: 'forbidden', message: 'Accès non autorisé.' });
    const personas: AccountSummary[] = (await listUsers(databases.demo))
      .filter((user) => user.active)
      .map(toSummary);
    return personas;
  });

  app.post('/api/space', async (request, reply) => {
    const ctx = request.auth;
    if (!ctx)
      return reply.code(401).send({ error: 'unauthenticated', message: 'Connexion requise.' });
    if (!isAdmin(request))
      return reply.code(403).send({ error: 'forbidden', message: 'Accès non autorisé.' });
    const body = switchBody.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'invalid', message: 'Demande de bascule invalide.' });
    }

    let personaId: number | null = null;
    if (body.data.space === 'demo') {
      const persona = body.data.personaId
        ? await findUser(databases.demo, body.data.personaId)
        : await findDefaultPersona(databases.demo);
      if (!persona || !persona.active) {
        return reply
          .code(409)
          .send({ error: 'no_persona', message: 'Aucun compte de démonstration disponible.' });
      }
      personaId = persona.id;
    }

    await setSessionSpace(databases.production, ctx.token, body.data.space, personaId);
    // La bascule est journalisée en production : c'est là que vit l'identité de l'administrateur.
    await audit(databases.production, {
      actorId: ctx.user.id,
      actorLabel: ctx.user.email,
      action: 'space.switch',
      details: { from: ctx.space, to: body.data.space, personaId },
    });
    const updated = await resolveContext(databases, ctx.token);
    return toMe(updated!);
  });
}
