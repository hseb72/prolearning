import type pg from 'pg';

/** Activité et module tels que stockés (contenu au format d'échange, déjà validé). */
export type RawActivity = Record<string, any> & { id: string; type: string };
export type RawModule = Record<string, any> & { id: string; activites: RawActivity[] };
export type RawFormation = Record<string, any> & {
  id: string;
  version: string;
  progression: { deblocage: 'sequentiel' | 'libre'; seuilReussite: number };
  modules: RawModule[];
};

/** Version courante d'une formation dans la base donnée (celle de l'espace actif). */
export async function currentFormation(db: pg.Pool, id: string): Promise<RawFormation | null> {
  const res = await db.query<{ content: RawFormation }>(
    `SELECT v.content FROM pl_formations f
     JOIN pl_formation_versions v ON v.formation_id = f.id AND v.version = f.current_version
     WHERE f.id = $1`,
    [id],
  );
  return res.rows[0]?.content ?? null;
}

export async function allCurrentFormations(db: pg.Pool): Promise<RawFormation[]> {
  const res = await db.query<{ content: RawFormation }>(
    `SELECT v.content FROM pl_formations f
     JOIN pl_formation_versions v ON v.formation_id = f.id AND v.version = f.current_version
     ORDER BY v.titre`,
  );
  return res.rows.map((r) => r.content);
}

export function findActivity(
  formation: RawFormation,
  moduleId: string,
  activiteId: string,
): { module: RawModule; activity: RawActivity } | null {
  const module = formation.modules.find((m) => m.id === moduleId);
  const activity = module?.activites.find((a) => a.id === activiteId);
  return module && activity ? { module, activity } : null;
}

export const isMandatory = (activity: RawActivity): boolean => activity['obligatoire'] !== false;
