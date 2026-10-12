import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import { DEFAULT_POINTS } from '../../shared/gamification.js';
import type {
  ActivityState,
  ActivityStatus,
  CompletionResult,
  ExerciseCorrection,
  FormationCard,
  FormationProgress,
  LearnerFormationResponse,
  QuizAttempt,
  QuizCorrection,
  ScenarioStep,
} from '../../shared/learning.js';
import { requireAuth, type RequestContext } from './context.js';
import {
  allCurrentFormations,
  currentFormation,
  findActivity,
  type RawActivity,
  type RawFormation,
} from './learning/content.js';
import {
  askedQuestions,
  drawQuestions,
  gradeAssociation,
  gradeOrder,
  gradeQuiz,
  replayScenario,
} from './learning/grading.js';
import {
  defaultPoints,
  formationProgress,
  learnerProfile,
  recordResult,
} from './learning/progress.js';
import { activitySeed, quizThreshold, toLearnerFormation } from './learning/view.js';

const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(64);
const activityParams = z.object({ formation: slug, module: slug, activite: slug });

/** Clé de l'apprenant pour les mélanges et clés opaques : son compte dans l'espace actif. */
const learnerKey = (ctx: RequestContext) => `${ctx.space}:${ctx.actor.id}`;

/**
 * Parcours en ligne : lecture, exercices corrigés par l'API, progression. Ouvert à tout
 * compte connecté ; chacun ne voit et n'écrit que sa propre progression, dans l'espace
 * actif (`request.auth.db`, compte `request.auth.actor`).
 */
export function registerLearningRoutes(app: FastifyInstance): void {
  const auth = { preHandler: requireAuth };
  registerReader(app, learnerBackend);

  app.get('/api/parcours', auth, async (request): Promise<FormationCard[]> => {
    const ctx = request.auth!;
    const formations = await allCurrentFormations(ctx.db);
    return Promise.all(
      formations.map(async (f) => {
        const progress = await formationProgress(ctx.db, ctx.actor.id, f);
        return {
          id: f.id,
          titre: f['titre'],
          ...(f['sousTitre'] ? { sousTitre: f['sousTitre'] } : {}),
          theme: f['theme'],
          resume: f['resume'],
          dureeEstimeeMinutes: f['dureeEstimeeMinutes'],
          ...(f['niveau'] ? { niveau: f['niveau'] } : {}),
          modulesTotal: f.modules.length,
          modulesTermines: Object.values(progress.modules).filter((m) => m.termine).length,
          points: progress.points,
        };
      }),
    );
  });

  app.get('/api/parcours/profil', auth, async (request) => {
    const ctx = request.auth!;
    return learnerProfile(ctx.db, ctx.actor.id, await allCurrentFormations(ctx.db));
  });
}

/** Résultat d'une activité, tel que l'API le corrige. */
type ActivityResult = {
  status: Exclude<ActivityStatus, 'a-faire'>;
  score: number | null;
  points: number;
};

/**
 * Où le lecteur lit les formations et ce qu'il fait des résultats : l'apprenant de l'espace
 * actif (progression enregistrée), ou l'aperçu d'évaluation (rien n'est enregistré).
 */
export interface ReaderBackend {
  prefix: string;
  guard: preHandlerHookHandler;
  db(request: FastifyRequest): pg.Pool;
  key(ctx: RequestContext): string;
  progress(request: FastifyRequest, formation: RawFormation): Promise<FormationProgress>;
  record(
    request: FastifyRequest,
    formation: RawFormation,
    moduleId: string,
    activity: RawActivity,
    result: ActivityResult,
  ): Promise<CompletionResult>;
  startQuiz(
    request: FastifyRequest,
    formation: RawFormation,
    moduleId: string,
    activity: RawActivity,
    questionIds: string[],
  ): Promise<number>;
  /** Questions de la tentative, si elle peut être corrigée (une seule fois). */
  finishQuiz(
    request: FastifyRequest,
    formation: RawFormation,
    moduleId: string,
    activity: RawActivity,
    tentative: number,
    answered: string[],
  ): Promise<string[] | null>;
}

/** L'apprenant : son compte dans l'espace actif, progression enregistrée. */
const learnerBackend: ReaderBackend = {
  prefix: '/api/parcours',
  guard: requireAuth,
  db: (request) => request.auth!.db,
  key: learnerKey,
  progress: (request, formation) =>
    formationProgress(request.auth!.db, request.auth!.actor.id, formation),
  record: (request, formation, moduleId, activity, result) =>
    recordResult(request.auth!.db, request.auth!.actor.id, formation, moduleId, activity, result),
  async startQuiz(request, formation, moduleId, activity, ids) {
    const ctx = request.auth!;
    const res = await ctx.db.query<{ id: string }>(
      `INSERT INTO pl_quiz_attempts (user_id, formation_id, module_id, activite_id, question_ids)
       VALUES ($1, $2, $3, $4, $5) RETURNING id::text`,
      [ctx.actor.id, formation.id, moduleId, activity.id, ids],
    );
    return Number(res.rows[0]!.id);
  },
  async finishQuiz(request, formation, moduleId, activity, tentative) {
    const ctx = request.auth!;
    // Une tentative ne se corrige qu'une fois, pour son apprenant et son activité.
    const attempt = await ctx.db.query<{ question_ids: string[] }>(
      `UPDATE pl_quiz_attempts SET submitted_at = now()
       WHERE id = $1 AND user_id = $2 AND formation_id = $3 AND module_id = $4 AND activite_id = $5
         AND submitted_at IS NULL AND created_at > now() - interval '1 day'
       RETURNING question_ids`,
      [tentative, ctx.actor.id, formation.id, moduleId, activity.id],
    );
    return attempt.rows[0]?.question_ids ?? null;
  },
};

/**
 * Aperçu d'évaluation : l'administrateur relit une formation importée dans le lecteur.
 * Tout est ouvert, les exercices sont corrigés, mais rien n'est enregistré : l'évaluation
 * n'a ni comptes ni progression (CLAUDE.md, « Espaces »).
 */
export function previewBackend(evaluation: pg.Pool, guard: preHandlerHookHandler): ReaderBackend {
  return {
    prefix: '/api/evaluation/parcours',
    guard,
    db: () => evaluation,
    key: (ctx) => `evaluation:${ctx.user.id}`,
    progress: async (_request, formation) => ({
      activites: Object.fromEntries(formation.modules.map((m) => [m.id, {}])),
      modules: Object.fromEntries(
        formation.modules.map((m) => [m.id, { debloque: true, termine: false }]),
      ),
      points: 0,
      terminee: false,
    }),
    record: async (_request, _formation, _moduleId, _activity, result) => {
      const etat: ActivityState = {
        statut: result.status,
        points: result.points,
        score: result.score,
      };
      return { etat, moduleTermine: false };
    },
    // Sans enregistrement, la tentative est rejouée telle quelle : les questions corrigées
    // sont celles auxquelles l'aperçu répond.
    startQuiz: async () => 0,
    finishQuiz: async (_request, _formation, _moduleId, _activity, _tentative, answered) =>
      answered,
  };
}

/** Lecture d'une formation et corrections, pour l'apprenant ou pour l'aperçu. */
export function registerReader(app: FastifyInstance, backend: ReaderBackend): void {
  const auth = { preHandler: backend.guard };

  app.get(`${backend.prefix}/:formation`, auth, async (request, reply) => {
    const ctx = request.auth!;
    const id = slug.safeParse((request.params as Record<string, unknown>)['formation']);
    const formation = id.success ? await currentFormation(backend.db(request), id.data) : null;
    if (!formation) return notFound(reply, 'Formation introuvable.');
    const response: LearnerFormationResponse = {
      formation: toLearnerFormation(formation, backend.key(ctx)),
      progression: await backend.progress(request, formation),
    };
    return response;
  });

  /**
   * Charge la formation et l'activité visées, et vérifie que le module est ouvert à
   * l'apprenant et que l'activité est du type attendu. Répond lui-même en cas d'erreur.
   */
  async function target(
    request: FastifyRequest,
    reply: FastifyReply,
    types: string[],
  ): Promise<{
    ctx: RequestContext;
    formation: RawFormation;
    moduleId: string;
    activity: RawActivity;
    seed: string;
  } | null> {
    const ctx = request.auth!;
    const params = activityParams.safeParse(request.params);
    if (!params.success) {
      notFound(reply, 'Activité introuvable.');
      return null;
    }
    const formation = await currentFormation(backend.db(request), params.data.formation);
    const found = formation && findActivity(formation, params.data.module, params.data.activite);
    if (!formation || !found) {
      notFound(reply, 'Activité introuvable.');
      return null;
    }
    if (!types.includes(found.activity.type)) {
      await reply.code(400).send({
        error: 'invalid',
        message: 'Cette action ne s’applique pas à ce type d’activité.',
      });
      return null;
    }
    const progress = await backend.progress(request, formation);
    if (!progress.modules[found.module.id]?.debloque) {
      await reply
        .code(409)
        .send({ error: 'locked', message: 'Ce module s’ouvrira quand le précédent sera terminé.' });
      return null;
    }
    return {
      ctx,
      formation,
      moduleId: found.module.id,
      activity: found.activity,
      seed: activitySeed(backend.key(ctx), formation.id, found.module.id, found.activity.id),
    };
  }

  const base = `${backend.prefix}/:formation/modules/:module/activites/:activite`;

  // Leçon, diaporama, fiches : terminées quand l'apprenant le déclare.
  app.post(`${base}/terminee`, auth, async (request, reply): Promise<CompletionResult | void> => {
    const t = await target(request, reply, ['lecon', 'diaporama', 'fiches']);
    if (!t) return;
    return backend.record(request, t.formation, t.moduleId, t.activity, {
      status: 'faite',
      score: null,
      points: defaultPoints(t.activity),
    });
  });

  app.post(`${base}/quiz/tentative`, auth, async (request, reply): Promise<QuizAttempt | void> => {
    const t = await target(request, reply, ['quiz']);
    if (!t) return;
    const ids = drawQuestions(t.activity);
    const tentative = await backend.startQuiz(request, t.formation, t.moduleId, t.activity, ids);
    return { tentative, questions: askedQuestions(t.activity, ids) };
  });

  const quizBody = z.object({
    tentative: z.number().int().nonnegative(),
    reponses: z.record(z.string(), z.array(z.string()).max(50)),
  });

  app.post(
    `${base}/quiz/reponses`,
    auth,
    async (request, reply): Promise<QuizCorrection | void> => {
      const t = await target(request, reply, ['quiz']);
      if (!t) return;
      const body = quizBody.safeParse(request.body);
      if (!body.success) return invalid(reply);
      const questionIds = await backend.finishQuiz(
        request,
        t.formation,
        t.moduleId,
        t.activity,
        body.data.tentative,
        Object.keys(body.data.reponses),
      );
      // Une question retirée par une nouvelle version entre le tirage et la réponse est ignorée.
      const known = new Set((t.activity['questions'] as { id: string }[]).map((q) => q.id));
      const asked = questionIds?.filter((id) => known.has(id));
      if (!asked?.length) {
        return reply.code(409).send({
          error: 'attempt',
          message: 'Tentative inconnue ou déjà corrigée : recommencez le quiz.',
        });
      }
      const graded = gradeQuiz(t.activity, asked, body.data.reponses);
      const seuil = quizThreshold(t.formation, t.activity);
      const ratio = graded.bonnesReponses / graded.total;
      const reussi = ratio >= seuil;
      const override = t.activity['points'] as number | undefined;
      const points =
        override !== undefined
          ? reussi
            ? override
            : 0
          : DEFAULT_POINTS.quiz * graded.bonnesReponses;
      const recorded = await backend.record(request, t.formation, t.moduleId, t.activity, {
        status: reussi ? 'reussie' : 'echouee',
        score: ratio,
        points,
      });
      return { ...graded, seuil, reussi, ...recorded };
    },
  );

  const orderBody = z.object({ ordre: z.array(z.string().max(32)).max(100) });

  app.post(`${base}/ordre`, auth, async (request, reply): Promise<ExerciseCorrection | void> => {
    const t = await target(request, reply, ['ordre']);
    if (!t) return;
    const body = orderBody.safeParse(request.body);
    if (!body.success) return invalid(reply);
    const { juste, solution } = gradeOrder(t.activity, t.seed, body.data.ordre);
    const recorded = await backend.record(request, t.formation, t.moduleId, t.activity, {
      status: 'faite',
      score: juste ? 1 : 0,
      points: juste ? defaultPoints(t.activity) : 0,
    });
    return { juste, solution, explication: t.activity['explication'], ...recorded };
  });

  const associationBody = z.object({
    reponses: z.record(z.string().max(32), z.string().max(2000)),
  });

  app.post(
    `${base}/association`,
    auth,
    async (request, reply): Promise<ExerciseCorrection | void> => {
      const t = await target(request, reply, ['association']);
      if (!t) return;
      const body = associationBody.safeParse(request.body);
      if (!body.success) return invalid(reply);
      const { juste, solution } = gradeAssociation(t.activity, t.seed, body.data.reponses);
      const recorded = await backend.record(request, t.formation, t.moduleId, t.activity, {
        status: 'faite',
        score: juste ? 1 : 0,
        points: juste ? defaultPoints(t.activity) : 0,
      });
      return { juste, solution, explication: t.activity['explication'], ...recorded };
    },
  );

  const scenarioBody = z.object({ chemin: z.array(z.number().int().min(0).max(20)).max(200) });

  app.post(`${base}/scenario`, auth, async (request, reply): Promise<ScenarioStep | void> => {
    const t = await target(request, reply, ['scenario']);
    if (!t) return;
    const body = scenarioBody.safeParse(request.body);
    if (!body.success) return invalid(reply);
    const step = replayScenario(t.activity, body.data.chemin);
    if ('error' in step) return reply.code(400).send({ error: 'invalid', message: step.error });
    if ('noeud' in step) return step;
    const recorded = await backend.record(request, t.formation, t.moduleId, t.activity, {
      status: 'faite',
      score: step.fin.etoiles,
      points: defaultPoints(t.activity, step.fin.etoiles),
    });
    return { ...(step.retour ? { retour: step.retour } : {}), fin: { ...step.fin, ...recorded } };
  });
}

function notFound(reply: FastifyReply, message: string) {
  return reply.code(404).send({ error: 'not_found', message });
}

function invalid(reply: FastifyReply) {
  return reply.code(400).send({ error: 'invalid', message: 'Réponse invalide.' });
}
