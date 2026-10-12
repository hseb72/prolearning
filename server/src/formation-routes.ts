import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { ImportResult, ValidationReport } from '../../shared/format.js';
import { audit } from './audit.js';
import { requireRole, type RequestContext } from './context.js';
import type { Databases } from './databases.js';
import { formationSource, listFormations, storeFormation } from './format/store.js';
import { validateFormation } from './format/validate.js';
import { previewBackend, registerReader } from './learning-routes.js';

export const versionParams = z.object({
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
 * Garde de l'administration des formations : le compte joué ET la personne réelle sont
 * administrateurs (en démonstration, jouer un collaborateur retire l'accès).
 */
export async function requireFormationAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await requireRole('admin')(request, reply);
  if (!reply.sent && request.auth!.user.role !== 'admin') {
    await reply.code(403).send({ error: 'forbidden', message: 'Accès non autorisé.' });
  }
}

/**
 * Formations au format d'échange, dans l'espace d'ÉVALUATION (troisième base, jamais
 * réinitialisée) : validation, import, liste et export. La publication en production et
 * la copie en démonstration vivent dans publication.ts.
 */
export function registerFormationRoutes(app: FastifyInstance, databases: Databases): void {
  const admin = { preHandler: requireFormationAdmin };
  const evaluation = databases.evaluation;
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

  // Import atomique (une transaction) : la formation n'apparaît qu'entièrement enregistrée.
  app.post('/api/formations/import', admin, async (request, reply) => {
    const ctx = request.auth!;
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
      evaluation,
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
        // L'évaluation n'a pas de comptes : la personne est dans le libellé et au journal.
        importedBy: null,
        importedByLabel: ctx.user.email,
      },
    );
    if ('refus' in decision) {
      const result: ImportResult = { rapport, importee: false, refus: decision.refus };
      return reply.code(409).send(result);
    }
    // Journal permanent : celui de la production, où vit l'identité de l'administrateur.
    await audit(databases.production, {
      actorId: ctx.user.id,
      actorLabel: ctx.user.email,
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

  app.get('/api/formations', admin, async () => listFormations(evaluation));

  // Relecture dans le lecteur, avant publication : aperçu sans enregistrement.
  registerReader(app, previewBackend(evaluation, requireFormationAdmin));

  app.get('/api/formations/:id/versions/:version/export', admin, async (request, reply) => {
    const params = versionParams.safeParse(request.params);
    if (!params.success)
      return reply.code(400).send({ error: 'invalid', message: 'Version invalide.' });
    const source = await formationSource(evaluation, params.data.id, params.data.version);
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
