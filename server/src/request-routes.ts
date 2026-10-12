import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { COURSE_ID_PATTERN } from '../../shared/catalog.js';
import type { MyRequests, TeamRequests, TrainingQueue } from '../../shared/requests.js';
import { courseExists } from './catalog/store.js';
import { requireAuth, requireRole } from './context.js';
import {
  cancelCustomRequest,
  cancelRegistration,
  createCustomRequest,
  createRegistration,
  customRequest,
  managerDecision,
  myCustomRequests,
  myRegistrations,
  processCustomRequest,
  registration,
  teamRegistrations,
  trainingCustomRequests,
  trainingDecision,
  trainingRegistrations,
  type Outcome,
} from './requests/store.js';

const comment = z.string().trim().max(2000).default('');
const idParam = z.object({ id: z.coerce.number().int().positive() });
const registrationBody = z.object({
  sessionId: z.number().int().positive(),
  motif: comment,
});
const decisionBody = z.object({
  decision: z.enum(['accepter', 'refuser']),
  commentaire: comment,
});
const customBody = z.object({
  courseId: z.string().regex(COURSE_ID_PATTERN).max(64).nullable().default(null),
  sujet: z.string().trim().min(1).max(300),
  modalite: z.enum(['distance', 'site', 'indifferent']),
  participants: z.number().int().min(1).max(500),
  periode: z.string().trim().max(300).default(''),
  details: z.string().trim().max(5000).default(''),
});
const processingBody = z.object({
  statut: z.enum(['en_cours', 'acceptee', 'refusee']),
  commentaire: comment,
});

const invalid = (reply: FastifyReply) =>
  reply.code(400).send({ error: 'invalid', message: 'Demande invalide.' });

/** Répond un refus métier, ou rien (le résultat est alors exploitable). */
function refused<T>(reply: FastifyReply, outcome: Outcome<T>): boolean {
  if ('refus' in outcome) {
    void reply
      .code(outcome.refus.status)
      .send({ error: outcome.refus.status === 404 ? 'not_found' : 'conflict', ...outcome.refus });
    return true;
  }
  return false;
}

/**
 * Demandes (décision 4 de CLAUDE.md) : inscription à une session en direct, validée par le
 * manager du demandeur puis confirmée par l'équipe formation ; session sur mesure demandée
 * par un manager. Chacun ne voit que ses demandes, le manager celles de son équipe.
 */
export function registerRequestRoutes(app: FastifyInstance): void {
  const auth = { preHandler: requireAuth };
  const manager = { preHandler: requireRole('manager') };
  const team = { preHandler: requireRole('training') };

  app.get('/api/demandes', auth, async (request): Promise<MyRequests> => {
    const ctx = request.auth!;
    return {
      inscriptions: await myRegistrations(ctx.db, ctx.actor.id),
      surMesure: await myCustomRequests(ctx.db, ctx.actor.id),
    };
  });

  app.post('/api/demandes/inscriptions', auth, async (request, reply) => {
    const ctx = request.auth!;
    const body = registrationBody.safeParse(request.body);
    if (!body.success) return invalid(reply);
    const outcome = await createRegistration(
      ctx.db,
      ctx.actor,
      body.data.sessionId,
      body.data.motif,
    );
    if (refused(reply, outcome) || !('ok' in outcome)) return reply;
    return reply.code(201).send(await registration(ctx.db, outcome.ok));
  });

  app.post('/api/demandes/inscriptions/:id/annulation', auth, async (request, reply) => {
    const ctx = request.auth!;
    const p = idParam.safeParse(request.params);
    if (!p.success) return invalid(reply);
    const outcome = await cancelRegistration(ctx.db, ctx.actor, p.data.id);
    if (refused(reply, outcome)) return reply;
    return registration(ctx.db, p.data.id);
  });

  // Manager : demandes de son équipe.
  app.get('/api/demandes/equipe', manager, async (request): Promise<TeamRequests> => {
    const ctx = request.auth!;
    return teamRegistrations(ctx.db, ctx.actor.id);
  });

  app.post('/api/demandes/inscriptions/:id/avis-manager', manager, async (request, reply) => {
    const ctx = request.auth!;
    const p = idParam.safeParse(request.params);
    const body = decisionBody.safeParse(request.body);
    if (!p.success || !body.success) return invalid(reply);
    const outcome = await managerDecision(
      ctx.db,
      ctx.actor,
      p.data.id,
      body.data.decision === 'accepter',
      body.data.commentaire,
    );
    if (refused(reply, outcome)) return reply;
    return registration(ctx.db, p.data.id);
  });

  // Équipe formation : file de traitement.
  app.get('/api/demandes/a-traiter', team, async (request): Promise<TrainingQueue> => {
    const ctx = request.auth!;
    return {
      inscriptions: await trainingRegistrations(ctx.db),
      surMesure: await trainingCustomRequests(ctx.db),
    };
  });

  app.post('/api/demandes/inscriptions/:id/decision', team, async (request, reply) => {
    const ctx = request.auth!;
    const p = idParam.safeParse(request.params);
    const body = decisionBody.safeParse(request.body);
    if (!p.success || !body.success) return invalid(reply);
    const outcome = await trainingDecision(
      ctx.db,
      ctx.actor,
      p.data.id,
      body.data.decision === 'accepter',
      body.data.commentaire,
    );
    if (refused(reply, outcome)) return reply;
    return registration(ctx.db, p.data.id);
  });

  // Sessions sur mesure : demandées par un manager, traitées par l'équipe formation.
  app.post('/api/demandes/sur-mesure', manager, async (request, reply) => {
    const ctx = request.auth!;
    const body = customBody.safeParse(request.body);
    if (!body.success) return invalid(reply);
    if (body.data.courseId && !(await courseExists(ctx.db, body.data.courseId))) {
      return reply.code(409).send({ error: 'conflict', message: 'Fiche formation introuvable.' });
    }
    const id = await createCustomRequest(ctx.db, ctx.actor, body.data);
    return reply.code(201).send(await customRequest(ctx.db, id));
  });

  app.post('/api/demandes/sur-mesure/:id/annulation', auth, async (request, reply) => {
    const ctx = request.auth!;
    const p = idParam.safeParse(request.params);
    if (!p.success) return invalid(reply);
    const outcome = await cancelCustomRequest(ctx.db, ctx.actor, p.data.id);
    if (refused(reply, outcome)) return reply;
    return customRequest(ctx.db, p.data.id);
  });

  app.post('/api/demandes/sur-mesure/:id/traitement', team, async (request, reply) => {
    const ctx = request.auth!;
    const p = idParam.safeParse(request.params);
    const body = processingBody.safeParse(request.body);
    if (!p.success || !body.success) return invalid(reply);
    const outcome = await processCustomRequest(ctx.db, ctx.actor, p.data.id, body.data);
    if (refused(reply, outcome)) return reply;
    return customRequest(ctx.db, p.data.id);
  });
}
