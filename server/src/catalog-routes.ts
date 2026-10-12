import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  COURSE_ID_PATTERN,
  MODALITES,
  type CourseCard,
  type CourseDetail,
  type FormationOption,
  type SessionView,
} from '../../shared/catalog.js';
import { hasRole } from '../../shared/roles.js';
import { audit } from './audit.js';
import {
  cancelSession,
  courseExists,
  createCourse,
  createSession,
  formationExists,
  formationOptions,
  getCourse,
  getSession,
  listCourses,
  updateCourse,
  updateSession,
  upcomingSessions,
} from './catalog/store.js';
import { requireAuth, requireRole, type RequestContext } from './context.js';
import { auditLabel } from './formation-routes.js';

const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => text(max).min(1);

const courseFields = z.object({
  titre: required(200),
  theme: required(100),
  resume: required(5000),
  objectifs: z.array(required(500)).max(20).default([]),
  public: text(1000).default(''),
  prerequis: text(1000).default(''),
  dureeHeures: z.number().positive().max(1000).nullable().default(null),
  formationId: z.string().max(64).nullable().default(null),
  publiee: z.boolean().default(false),
});
const courseCreate = courseFields.extend({
  id: z.string().regex(COURSE_ID_PATTERN).max(64),
});

const sessionBody = z
  .object({
    modalite: z.enum(MODALITES),
    debut: z.iso.datetime({ offset: true }),
    fin: z.iso.datetime({ offset: true }),
    lieu: text(500).default(''),
    formateur: text(200).default(''),
    places: z.number().int().min(1).max(1000),
  })
  .refine((s) => new Date(s.fin) > new Date(s.debut), { path: ['fin'] });

const courseParam = z.object({ id: z.string().regex(COURSE_ID_PATTERN).max(64) });
const sessionParam = z.object({ id: z.coerce.number().int().positive() });

const invalid = (reply: FastifyReply, message: string) =>
  reply.code(400).send({ error: 'invalid', message });
const courseNotFound = (reply: FastifyReply) =>
  reply.code(404).send({ error: 'not_found', message: 'Fiche introuvable.' });
const sessionNotFound = (reply: FastifyReply) =>
  reply.code(404).send({ error: 'not_found', message: 'Session introuvable.' });

const isTeam = (ctx: RequestContext) => hasRole(ctx.actor.role, 'training');
const actor = (ctx: RequestContext) => ({ actorId: ctx.actor.id, actorLabel: auditLabel(ctx) });

/**
 * Catalogue et sessions. Lecture pour tout compte connecté (fiches publiées, sessions à
 * venir) ; gestion par l'équipe formation. Toujours dans la base de l'espace actif.
 */
export function registerCatalogRoutes(app: FastifyInstance): void {
  const auth = { preHandler: requireAuth };
  const team = { preHandler: requireRole('training') };

  app.get('/api/catalogue', auth, async (request): Promise<CourseCard[]> => {
    const ctx = request.auth!;
    return listCourses(ctx.db, isTeam(ctx));
  });

  app.get('/api/catalogue/:id', auth, async (request, reply): Promise<CourseDetail> => {
    const ctx = request.auth!;
    const p = courseParam.safeParse(request.params);
    if (!p.success) return courseNotFound(reply);
    const course = await getCourse(ctx.db, p.data.id, isTeam(ctx));
    return course ?? courseNotFound(reply);
  });

  app.get('/api/sessions', auth, async (request): Promise<SessionView[]> =>
    upcomingSessions(request.auth!.db),
  );

  app.get('/api/catalogue-parcours', team, async (request): Promise<FormationOption[]> =>
    formationOptions(request.auth!.db),
  );

  app.post('/api/catalogue', team, async (request, reply) => {
    const ctx = request.auth!;
    const body = courseCreate.safeParse(request.body);
    if (!body.success) return invalid(reply, 'Fiche invalide.');
    if (await courseExists(ctx.db, body.data.id)) {
      return reply
        .code(409)
        .send({ error: 'conflict', message: 'Une fiche porte déjà cet identifiant.' });
    }
    if (body.data.formationId && !(await formationExists(ctx.db, body.data.formationId))) {
      return reply.code(409).send({ error: 'conflict', message: 'Parcours en ligne introuvable.' });
    }
    await createCourse(ctx.db, body.data, ctx.actor.id);
    await audit(ctx.db, { ...actor(ctx), action: 'course.create', details: { id: body.data.id } });
    return reply.code(201).send(await getCourse(ctx.db, body.data.id, true));
  });

  app.put('/api/catalogue/:id', team, async (request, reply) => {
    const ctx = request.auth!;
    const p = courseParam.safeParse(request.params);
    if (!p.success) return courseNotFound(reply);
    const body = courseFields.safeParse(request.body);
    if (!body.success) return invalid(reply, 'Fiche invalide.');
    if (body.data.formationId && !(await formationExists(ctx.db, body.data.formationId))) {
      return reply.code(409).send({ error: 'conflict', message: 'Parcours en ligne introuvable.' });
    }
    if (!(await updateCourse(ctx.db, p.data.id, body.data, ctx.actor.id))) {
      return courseNotFound(reply);
    }
    await audit(ctx.db, { ...actor(ctx), action: 'course.update', details: { id: p.data.id } });
    return getCourse(ctx.db, p.data.id, true);
  });

  app.post('/api/catalogue/:id/sessions', team, async (request, reply) => {
    const ctx = request.auth!;
    const p = courseParam.safeParse(request.params);
    if (!p.success || !(await courseExists(ctx.db, p.data.id))) return courseNotFound(reply);
    const body = sessionBody.safeParse(request.body);
    if (!body.success) return invalid(reply, 'Session invalide : vérifiez les dates et places.');
    const id = await createSession(ctx.db, p.data.id, body.data);
    await audit(ctx.db, {
      ...actor(ctx),
      action: 'session.create',
      details: { id, courseId: p.data.id },
    });
    return reply.code(201).send(await getSession(ctx.db, id));
  });

  app.put('/api/sessions/:id', team, async (request, reply) => {
    const ctx = request.auth!;
    const p = sessionParam.safeParse(request.params);
    if (!p.success) return sessionNotFound(reply);
    const session = await getSession(ctx.db, p.data.id);
    if (!session) return sessionNotFound(reply);
    const body = sessionBody.safeParse(request.body);
    if (!body.success) return invalid(reply, 'Session invalide : vérifiez les dates et places.');
    if (session.annulee) {
      return reply
        .code(409)
        .send({ error: 'cancelled', message: 'Une session annulée ne se modifie plus.' });
    }
    const taken = session.places - session.placesRestantes;
    if (body.data.places < taken) {
      return reply.code(409).send({
        error: 'seats',
        message: `${taken} places sont déjà prises : la capacité ne peut pas descendre en dessous.`,
      });
    }
    await updateSession(ctx.db, p.data.id, body.data);
    await audit(ctx.db, { ...actor(ctx), action: 'session.update', details: { id: p.data.id } });
    return getSession(ctx.db, p.data.id);
  });

  app.post('/api/sessions/:id/annulation', team, async (request, reply) => {
    const ctx = request.auth!;
    const p = sessionParam.safeParse(request.params);
    if (!p.success) return sessionNotFound(reply);
    const session = await getSession(ctx.db, p.data.id);
    if (!session) return sessionNotFound(reply);
    if (!session.annulee) {
      await cancelSession(ctx.db, p.data.id);
      await audit(ctx.db, { ...actor(ctx), action: 'session.cancel', details: { id: p.data.id } });
    }
    return getSession(ctx.db, p.data.id);
  });
}
