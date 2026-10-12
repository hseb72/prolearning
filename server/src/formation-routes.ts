import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { ImportResult, ValidationReport } from '../../shared/format.js';
import { audit } from './audit.js';
import { requireRole, type RequestContext } from './context.js';
import { formationSource, listFormations, storeFormation } from './format/store.js';
import { validateFormation } from './format/validate.js';

const versionParams = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(64),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .max(32),
});

/** Corps brut d'un dépôt de fichier (application/octet-stream), sinon null. */
function uploadedFile(request: FastifyRequest): Buffer | null {
  return Buffer.isBuffer(request.body) ? request.body : null;
}

/**
 * Libellé du journal : la personne réelle, et le compte joué en démonstration. (Les
 * identifiants des deux bases ne se comparent pas : en démonstration, on joue toujours
 * un compte fictif.)
 */
export function auditLabel(ctx: RequestContext): string {
  return ctx.space === 'demo'
    ? `${ctx.user.email} (en tant que ${ctx.actor.displayName})`
    : ctx.user.email;
}

/**
 * Formations au format d'échange : validation, import (en démonstration), liste et
 * export. Tout passe par `request.auth.db`, la base de l'espace actif. La publication
 * vers la production, seule opération qui touche les deux bases, vit dans publication.ts.
 */
export function registerFormationRoutes(app: FastifyInstance): void {
  const admin = { preHandler: requireRole('admin') };
  const badFile = (reply: FastifyReply) =>
    reply.code(400).send({ error: 'invalid', message: 'Déposez un fichier .formation.json.' });

  app.post(
    '/api/formations/validation',
    admin,
    async (request, reply): Promise<ValidationReport> => {
      const file = uploadedFile(request);
      if (!file) return badFile(reply);
      return validateFormation(file);
    },
  );

  app.post('/api/formations/import', admin, async (request, reply) => {
    const ctx = request.auth!;
    if (ctx.space !== 'demo') {
      return reply.code(409).send({
        error: 'wrong_space',
        message:
          'Une formation s’importe dans l’espace démonstration, pour y être relue avant publication.',
      });
    }
    const file = uploadedFile(request);
    if (!file) return badFile(reply);
    const rapport = validateFormation(file);
    if (!rapport.ok || !rapport.formation) {
      const result: ImportResult = { rapport, importee: false };
      return reply.code(422).send(result);
    }
    const document = JSON.parse(file.toString('utf8')) as Record<string, string>;
    const replace = (request.query as Record<string, unknown>)['remplacer'] === 'oui';
    const decision = await storeFormation(
      ctx.db,
      {
        id: rapport.formation.id,
        version: rapport.formation.version,
        formatVersion: document['formatVersion']!,
        titre: document['titre']!,
        theme: document['theme']!,
        source: file.toString('utf8'),
      },
      {
        allowReplace: replace,
        origin: 'import',
        importedBy: ctx.actor.id,
        importedByLabel: auditLabel(ctx),
      },
    );
    if ('refus' in decision) {
      const result: ImportResult = { rapport, importee: false, refus: decision.refus };
      return reply.code(409).send(result);
    }
    await audit(ctx.db, {
      actorId: ctx.actor.id,
      actorLabel: auditLabel(ctx),
      action: 'formation.import',
      details: {
        id: rapport.formation.id,
        version: rapport.formation.version,
        action: decision.action,
      },
    });
    const result: ImportResult = { rapport, importee: true, action: decision.action };
    return reply.code(201).send(result);
  });

  app.get('/api/formations', admin, async (request) => listFormations(request.auth!.db));

  app.get('/api/formations/:id/versions/:version/export', admin, async (request, reply) => {
    const params = versionParams.safeParse(request.params);
    if (!params.success)
      return reply.code(400).send({ error: 'invalid', message: 'Version invalide.' });
    const source = await formationSource(request.auth!.db, params.data.id, params.data.version);
    if (source === null) {
      return reply.code(404).send({ error: 'not_found', message: 'Version introuvable.' });
    }
    return reply
      .header('content-type', 'application/json; charset=utf-8')
      .header(
        'content-disposition',
        `attachment; filename="${params.data.id}-${params.data.version}.formation.json"`,
      )
      .send(source);
  });
}
