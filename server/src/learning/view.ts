import { createHash } from 'node:crypto';
import type { Bloc, LearnerActivity, LearnerFormation } from '../../../shared/learning.js';
import type { RawActivity, RawFormation } from './content.js';

/**
 * Vue d'apprenant d'une formation : le contenu sans les réponses. L'ordre et les paires
 * à reconstituer sont mélangés, et leurs identifiants remplacés par des clés opaques
 * (sinon `e1, e2, e3`… trahiraient l'ordre). Mélange et clés sont stables pour un même
 * apprenant et une même activité, pour que la page ne change pas d'un affichage à l'autre.
 */
export function opaqueKey(seed: string, id: string): string {
  return createHash('sha256').update(`${seed}\u0000${id}`).digest('base64url').slice(0, 12);
}

/** Mélange déterministe (mulberry32), graine dérivée de `seed`. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  let state = createHash('sha256').update(seed).digest().readUInt32LE(0);
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  // Un mélange qui rend l'ordre d'origine n'apprend rien : on décale d'un cran.
  if (result.length > 1 && result.every((item, i) => item === items[i]))
    result.push(result.shift()!);
  return result;
}

export function activitySeed(
  learnerKey: string,
  formationId: string,
  moduleId: string,
  activiteId: string,
): string {
  return `${learnerKey}:${formationId}:${moduleId}:${activiteId}`;
}

function toLearnerActivity(activity: RawActivity, seed: string): LearnerActivity {
  const base = {
    id: activity.id,
    titre: activity['titre'] as string,
    obligatoire: activity['obligatoire'] !== false,
    ...(activity['dureeEstimeeMinutes']
      ? { dureeEstimeeMinutes: activity['dureeEstimeeMinutes'] }
      : {}),
  };
  switch (activity.type) {
    case 'lecon':
      return { ...base, type: 'lecon', blocs: activity['blocs'] as Bloc[] };
    case 'diaporama':
      return { ...base, type: 'diaporama', diapos: activity['diapos'] };
    case 'fiches':
      return { ...base, type: 'fiches', cartes: activity['cartes'] };
    case 'quiz':
      return {
        ...base,
        type: 'quiz',
        questionsParTentative: activity['tirage'] ?? activity['questions'].length,
        seuil: 0, // renseigné par l'appelant, qui connaît le seuil de la formation
      };
    case 'ordre': {
      const elements = (activity['elements'] as { id: string; texte: string }[]).map((e) => ({
        cle: opaqueKey(seed, e.id),
        texte: e.texte,
      }));
      return {
        ...base,
        type: 'ordre',
        consigne: activity['consigne'],
        elements: seededShuffle(elements, seed),
      };
    }
    case 'association': {
      const paires = activity['paires'] as { id: string; gauche: string; droite: string }[];
      return {
        ...base,
        type: 'association',
        consigne: activity['consigne'],
        gauches: paires.map((p) => ({ cle: opaqueKey(seed, p.id), texte: p.gauche })),
        droites: seededShuffle(
          paires.map((p) => p.droite),
          `${seed}:droites`,
        ),
      };
    }
    case 'scenario':
      return { ...base, type: 'scenario', contexte: activity['contexte'] };
    default:
      throw new Error(`Type d'activité inconnu : ${activity.type}`);
  }
}

/** Seuil de réussite d'un quiz : le sien, sinon celui de la formation (§ 4, § 6.3). */
export function quizThreshold(formation: RawFormation, activity: RawActivity): number {
  return (activity['seuil'] as number | undefined) ?? formation.progression.seuilReussite;
}

export function toLearnerFormation(formation: RawFormation, learnerKey: string): LearnerFormation {
  return {
    id: formation.id,
    version: formation.version,
    titre: formation['titre'],
    ...(formation['sousTitre'] ? { sousTitre: formation['sousTitre'] } : {}),
    theme: formation['theme'],
    resume: formation['resume'],
    public: formation['public'],
    prerequis: formation['prerequis'],
    objectifs: formation['objectifs'],
    dureeEstimeeMinutes: formation['dureeEstimeeMinutes'],
    ...(formation['niveau'] ? { niveau: formation['niveau'] } : {}),
    droits: formation['droits'],
    deblocage: formation.progression.deblocage,
    references: (formation['references'] ?? []).map((r: Record<string, unknown>) => {
      const { consulteLe: _checked, ...reference } = r;
      return reference;
    }),
    glossaire: (formation['glossaire'] ?? []).map((g: Record<string, unknown>) => ({
      terme: g['terme'],
      definition: g['definition'],
    })),
    modules: formation.modules.map((module) => ({
      id: module.id,
      titre: module['titre'],
      resume: module['resume'],
      objectifs: module['objectifs'],
      dureeEstimeeMinutes: module['dureeEstimeeMinutes'],
      activites: module.activites.map((activity) => {
        const view = toLearnerActivity(
          activity,
          activitySeed(learnerKey, formation.id, module.id, activity.id),
        );
        return view.type === 'quiz' ? { ...view, seuil: quizThreshold(formation, activity) } : view;
      }),
    })),
  };
}
