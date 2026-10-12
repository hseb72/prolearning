import type { FastifyInstance, FastifyReply } from 'fastify';
import type pg from 'pg';
import type { DemoCopyResult, PublishResult } from '../../shared/format.js';
import { audit } from './audit.js';
import type { Databases } from './databases.js';
import { requireFormationAdmin, versionParams } from './formation-routes.js';
import {
  formationSource,
  markCopiedToDemo,
  markPublished,
  storeFormation,
  type StoreDecision,
} from './format/store.js';
import { validateFormation } from './format/validate.js';

/**
 * Sorties de l'évaluation, comme le prévoit CLAUDE.md (décision 3) : le texte exact est
 * exporté de la base d'évaluation, puis importé dans la base cible avec la validation et
 * les règles de version du § 11. Aucune requête ne joint deux bases.
 *
 * - Publication → production : jamais de remplacement d'une version déjà publiée.
 * - Copie → démonstration : pour montrer la formation ; la copie disparaît à la
 *   réinitialisation de la démo, l'original reste en évaluation.
 */
export function registerPublicationRoutes(app: FastifyInstance, databases: Databases): void {
  const admin = { preHandler: requireFormationAdmin };

  /** Relit la version en évaluation et l'importe dans `target`. Répond aux erreurs. */
  async function transfer(
    reply: FastifyReply,
    params: unknown,
    target: pg.Pool,
    options: { allowReplace: boolean; origin: 'publication' | 'copie'; by: string },
  ): Promise<{ id: string; version: string; decision: StoreDecision } | null> {
    const p = versionParams.safeParse(params);
    if (!p.success) {
      await reply.code(400).send({ error: 'invalid', message: 'Version invalide.' });
      return null;
    }
    const source = await formationSource(databases.evaluation, p.data.id, p.data.version);
    if (source === null) {
      await reply
        .code(404)
        .send({ error: 'not_found', message: 'Version introuvable en évaluation.' });
      return null;
    }
    if (!validateFormation(source).ok) {
      await reply.code(422).send({ error: 'invalid', refus: 'La version n’est plus valide.' });
      return null;
    }
    const document = JSON.parse(source) as Record<string, string>;
    const decision = await storeFormation(
      target,
      {
        id: p.data.id,
        version: p.data.version,
        formatVersion: document['formatVersion']!,
        titre: document['titre']!,
        theme: document['theme']!,
        source,
      },
      {
        allowReplace: options.allowReplace,
        origin: options.origin,
        importedBy: null,
        importedByLabel: options.by,
      },
    );
    return { id: p.data.id, version: p.data.version, decision };
  }

  app.post('/api/formations/:id/versions/:version/publication', admin, async (request, reply) => {
    const ctx = request.auth!;
    const done = await transfer(reply, request.params, databases.production, {
      allowReplace: false, // jamais en production (§ 11)
      origin: 'publication',
      by: ctx.user.email,
    });
    if (!done) return reply;
    if ('refus' in done.decision) {
      const result: PublishResult = { publiee: false, refus: done.decision.refus };
      return reply.code(409).send(result);
    }
    await markPublished(databases.evaluation, done.id, done.version);
    await audit(databases.production, {
      actorId: ctx.user.id,
      actorLabel: ctx.user.email,
      action: 'formation.publish',
      details: { id: done.id, version: done.version, action: done.decision.action },
    });
    const result: PublishResult = {
      publiee: true,
      action: done.decision.action as PublishResult['action'],
    };
    return reply.code(201).send(result);
  });

  app.post('/api/formations/:id/versions/:version/copie-demo', admin, async (request, reply) => {
    const ctx = request.auth!;
    const done = await transfer(reply, request.params, databases.demo, {
      // La démonstration sert à montrer : on peut y recopier une version corrigée.
      allowReplace: true,
      origin: 'copie',
      by: ctx.user.email,
    });
    if (!done) return reply;
    if ('refus' in done.decision) {
      const result: DemoCopyResult = { copiee: false, refus: done.decision.refus };
      return reply.code(409).send(result);
    }
    await markCopiedToDemo(databases.evaluation, done.id, done.version);
    await audit(databases.production, {
      actorId: ctx.user.id,
      actorLabel: ctx.user.email,
      action: 'formation.copy_demo',
      details: { id: done.id, version: done.version, action: done.decision.action },
    });
    const result: DemoCopyResult = { copiee: true };
    return reply.code(201).send(result);
  });
}
