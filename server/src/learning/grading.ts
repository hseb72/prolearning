import { randomInt } from 'node:crypto';
import type { RawActivity } from './content.js';
import { opaqueKey } from './view.js';

/** Corrections des exercices. Pures : aucune base, aucun espace. */

type Question = {
  id: string;
  type: 'choix_unique' | 'choix_multiple' | 'vrai_faux';
  enonce: string;
  options: { id: string; texte: string }[];
  bonnes: string[];
  explication: string;
  indice?: string;
  references?: string[];
};

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/** Questions d'une tentative : tirage aléatoire si demandé (§ 6.3), sinon toutes. */
export function drawQuestions(activity: RawActivity): string[] {
  const questions = activity['questions'] as Question[];
  const tirage = activity['tirage'] as number | undefined;
  const ids = questions.map((q) => q.id);
  return tirage ? shuffle(ids).slice(0, tirage) : ids;
}

/** Questions telles que posées : sans bonnes réponses ni explications. */
export function askedQuestions(activity: RawActivity, questionIds: string[]) {
  const byId = new Map((activity['questions'] as Question[]).map((q) => [q.id, q]));
  const mix = activity['melangerOptions'] !== false;
  return questionIds.map((id) => {
    const q = byId.get(id)!;
    return {
      id: q.id,
      type: q.type,
      enonce: q.enonce,
      ...(q.indice ? { indice: q.indice } : {}),
      options: mix ? shuffle(q.options) : q.options,
    };
  });
}

/**
 * Corrige une tentative. Une question à choix multiple n'est juste que si toutes les bonnes
 * options, et elles seules, sont cochées (§ 6.3).
 */
export function gradeQuiz(
  activity: RawActivity,
  questionIds: string[],
  answers: Record<string, string[]>,
) {
  const byId = new Map((activity['questions'] as Question[]).map((q) => [q.id, q]));
  const questions = questionIds.map((id) => {
    const q = byId.get(id)!;
    const given = new Set(answers[id] ?? []);
    const juste = given.size === q.bonnes.length && q.bonnes.every((b) => given.has(b));
    return {
      id,
      juste,
      bonnes: q.bonnes,
      explication: q.explication,
      references: q.references ?? [],
    };
  });
  const bonnesReponses = questions.filter((q) => q.juste).length;
  return { questions, bonnesReponses, total: questions.length };
}

/** Ordre : les clés opaques reçues, comparées à l'ordre juste. */
export function gradeOrder(activity: RawActivity, seed: string, keys: string[]) {
  const expected = (activity['elements'] as { id: string }[]).map((e) => opaqueKey(seed, e.id));
  const juste = keys.length === expected.length && keys.every((key, i) => key === expected[i]);
  return { juste, solution: expected };
}

/** Association : pour chaque gauche (clé opaque), la droite choisie. */
export function gradeAssociation(
  activity: RawActivity,
  seed: string,
  answers: Record<string, string>,
) {
  const paires = activity['paires'] as { id: string; droite: string }[];
  const solution = Object.fromEntries(paires.map((p) => [opaqueKey(seed, p.id), p.droite]));
  const juste = paires.every((p) => answers[opaqueKey(seed, p.id)] === p.droite);
  return { juste, solution };
}

type ScenarioNode = {
  texte: string;
  choix: { texte: string; points: number; retour: string; suivant: string }[];
};

/**
 * Rejoue un cas pratique à partir des choix faits (indices), depuis le début. Sans état
 * côté serveur : le navigateur renvoie le chemin entier, l'API recalcule tout. Les points
 * de chaque choix ne sont révélés qu'à la fin.
 */
export function replayScenario(
  activity: RawActivity,
  path: number[],
):
  | { error: string }
  | { retour?: string; noeud: { texte: string; choix: string[] } }
  | { retour?: string; fin: { points: number; etoiles: number; message: string } } {
  const nodes = activity['noeuds'] as Record<string, ScenarioNode>;
  let current: string = activity['debut'];
  let points = 0;
  let retour: string | undefined;
  for (const index of path) {
    if (current === 'fin') return { error: 'Le cas pratique est déjà terminé.' };
    const choice = nodes[current]?.choix[index];
    if (!choice) return { error: 'Choix invalide.' };
    points += choice.points;
    retour = choice.retour;
    current = choice.suivant;
  }
  if (current === 'fin') {
    const paliers = [
      ...(activity['paliers'] as { minPoints: number; etoiles: number; message: string }[]),
    ].sort((a, b) => b.minPoints - a.minPoints);
    const palier = paliers.find((p) => points >= p.minPoints)!;
    return { retour, fin: { points, etoiles: palier.etoiles, message: palier.message } };
  }
  const node = nodes[current]!;
  return { retour, noeud: { texte: node.texte, choix: node.choix.map((c) => c.texte) } };
}
