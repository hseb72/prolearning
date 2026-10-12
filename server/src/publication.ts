import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PublishResult } from '../../shared/format.js';
import { audit } from './audit.js';
import { requireRole } from './context.js';
import type { Databases } from './databases.js';
import { auditLabel } from './formation-routes.js';
import { formationSource, markPublished, storeFormation } from './format/store.js';
import { validateFormation } from './format/validate.js';

const params = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(64),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .max(32),
});

/**
 * Publication d'une formation relue en démonstration vers la production. C'est la seule
 * opération qui touche les deux bases, et elle le fait comme le prévoit CLAUDE.md
 * (décision 3) : export du texte exact depuis la démonstration, puis import en production
 * avec la validation et les règles de version du § 11. Aucune requête ne joint les bases.
 */
export function registerPublicationRoutes(app: FastifyInstance, databases: Databases): void {
  app.post(
    '/api/formations/:id/versions/:version/publication',
    { preHandler: requireRole('admin') },
    async (request, reply) => {
      const ctx = request.auth!;
      // Le compte joué doit être administrateur (requireRole), et la personne réelle aussi :
      // c'est elle qui publie en production.
      if (ctx.space !== 'demo' || ctx.user.role !== 'admin') {
        return reply.code(409).send({
          error: 'wrong_space',
          message: 'La publication se fait depuis l’espace démonstration, après relecture.',
        });
      }
      const p = params.safeParse(request.params);
      if (!p.success)
        return reply.code(400).send({ error: 'invalid', message: 'Version invalide.' });

      const source = await formationSource(databases.demo, p.data.id, p.data.version);
      if (source === null) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'Version introuvable en démonstration.' });
      }
      const rapport = validateFormation(source);
      if (!rapport.ok) {
        const result: PublishResult = { publiee: false, refus: 'La version n’est plus valide.' };
        return reply.code(422).send(result);
      }
      const document = JSON.parse(source) as Record<string, string>;
      const decision = await storeFormation(
        databases.production,
        {
          id: p.data.id,
          version: p.data.version,
          formatVersion: document['formatVersion']!,
          titre: document['titre']!,
          theme: document['theme']!,
          source,
        },
        {
          allowReplace: false, // jamais en production (§ 11)
          origin: 'publication',
          importedBy: ctx.user.id,
          importedByLabel: ctx.user.email,
        },
      );
      if ('refus' in decision) {
        const result: PublishResult = { publiee: false, refus: decision.refus };
        return reply.code(409).send(result);
      }
      await markPublished(databases.demo, p.data.id, p.data.version);
      const details = { id: p.data.id, version: p.data.version, action: decision.action };
      await audit(databases.production, {
        actorId: ctx.user.id,
        actorLabel: ctx.user.email,
        action: 'formation.publish',
        details,
      });
      await audit(databases.demo, {
        actorId: ctx.actor.id,
        actorLabel: auditLabel(ctx),
        action: 'formation.publish',
        details,
      });
      const result: PublishResult = {
        publiee: true,
        action: decision.action as PublishResult['action'],
      };
      return reply.code(201).send(result);
    },
  );
}
