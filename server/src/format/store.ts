import { createHash } from 'node:crypto';
import type pg from 'pg';
import type { FormationRow, FormationVersionRow } from '../../../shared/format.js';

/**
 * Enregistrement des formations dans UNE base (celle qu'on lui passe), selon les règles
 * de version du § 11. Ne connaît pas les espaces : c'est l'appelant qui choisit la base.
 */
export interface StoredFormation {
  id: string;
  version: string;
  formatVersion: string;
  titre: string;
  theme: string;
  source: string;
}

export type StoreDecision =
  { action: 'nouvelle' | 'nouvelle-version' | 'remplacement' } | { refus: string };

export interface Semver {
  major: number;
  minor: number;
  patch: number;
}

export function parseSemver(version: string): Semver {
  const [major, minor, patch] = version.split('.').map(Number);
  return { major: major!, minor: minor!, patch: patch! };
}

export function compareSemver(a: string, b: string): number {
  const x = parseSemver(a);
  const y = parseSemver(b);
  return x.major - y.major || x.minor - y.minor || x.patch - y.patch;
}

/** Règles du § 11. `allowReplace` : remplacement explicite d'une même version (démo seulement). */
export function decide(
  existing: { current: string; versions: string[] } | null,
  version: string,
  allowReplace: boolean,
): StoreDecision {
  if (!existing) return { action: 'nouvelle' };
  if (existing.versions.includes(version)) {
    return allowReplace
      ? { action: 'remplacement' }
      : {
          refus: `La version ${version} existe déjà. Augmentez la version, ou demandez explicitement son remplacement.`,
        };
  }
  if (compareSemver(version, existing.current) < 0) {
    return {
      refus: `Version ${version} inférieure à la version courante ${existing.current} : refusée.`,
    };
  }
  return { action: 'nouvelle-version' };
}

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Enregistre une version validée, en transaction et sous verrou de la formation : deux
 * imports simultanés de la même formation ne peuvent pas se croiser.
 */
export async function storeFormation(
  db: pg.Pool,
  formation: StoredFormation,
  options: {
    allowReplace: boolean;
    origin: 'import' | 'publication' | 'copie';
    importedBy: number | null;
    importedByLabel: string;
  },
): Promise<StoreDecision> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`formation:${formation.id}`]);
    const current = await client.query<{ current_version: string }>(
      'SELECT current_version FROM pl_formations WHERE id = $1',
      [formation.id],
    );
    const versions = await client.query<{ version: string }>(
      'SELECT version FROM pl_formation_versions WHERE formation_id = $1',
      [formation.id],
    );
    const existing = current.rows[0]
      ? { current: current.rows[0].current_version, versions: versions.rows.map((r) => r.version) }
      : null;
    const decision = decide(existing, formation.version, options.allowReplace);
    if ('refus' in decision) {
      await client.query('ROLLBACK');
      return decision;
    }

    const v = parseSemver(formation.version);
    if (decision.action === 'nouvelle') {
      await client.query('INSERT INTO pl_formations (id, current_version) VALUES ($1, $2)', [
        formation.id,
        formation.version,
      ]);
    } else if (decision.action === 'nouvelle-version') {
      await client.query(
        'UPDATE pl_formations SET current_version = $2, updated_at = now() WHERE id = $1',
        [formation.id, formation.version],
      );
    } else {
      await client.query('UPDATE pl_formations SET updated_at = now() WHERE id = $1', [
        formation.id,
      ]);
      await client.query(
        'DELETE FROM pl_formation_versions WHERE formation_id = $1 AND version = $2',
        [formation.id, formation.version],
      );
    }
    await client.query(
      `INSERT INTO pl_formation_versions
         (formation_id, version, version_major, version_minor, version_patch, format_version,
          titre, theme, source, content, sha256, origin, imported_by, imported_by_label)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14)`,
      [
        formation.id,
        formation.version,
        v.major,
        v.minor,
        v.patch,
        formation.formatVersion,
        formation.titre,
        formation.theme,
        formation.source,
        formation.source,
        sha256(formation.source),
        options.origin,
        options.importedBy,
        options.importedByLabel,
      ],
    );
    await client.query('COMMIT');
    return decision;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listFormations(db: pg.Pool): Promise<FormationRow[]> {
  const res = await db.query<{
    id: string;
    current_version: string;
    version: string;
    format_version: string;
    titre: string;
    theme: string;
    imported_at: Date;
    imported_by_label: string | null;
    origin: 'import' | 'publication' | 'copie';
    published_at: Date | null;
    copied_to_demo_at: Date | null;
  }>(
    `SELECT f.id, f.current_version, v.version, v.format_version, v.titre, v.theme,
            v.imported_at, v.imported_by_label, v.origin, v.published_at, v.copied_to_demo_at
     FROM pl_formations f JOIN pl_formation_versions v ON v.formation_id = f.id
     ORDER BY f.id, v.version_major DESC, v.version_minor DESC, v.version_patch DESC`,
  );
  const rows = new Map<string, FormationRow>();
  for (const r of res.rows) {
    let row = rows.get(r.id);
    if (!row) {
      row = { id: r.id, titre: '', theme: '', versionCourante: r.current_version, versions: [] };
      rows.set(r.id, row);
    }
    if (r.version === r.current_version) {
      row.titre = r.titre;
      row.theme = r.theme;
    }
    const version: FormationVersionRow = {
      version: r.version,
      formatVersion: r.format_version,
      importedAt: r.imported_at.toISOString(),
      importedBy: r.imported_by_label,
      origine: r.origin,
      publishedAt: r.published_at ? r.published_at.toISOString() : null,
      copiedToDemoAt: r.copied_to_demo_at ? r.copied_to_demo_at.toISOString() : null,
    };
    row.versions.push(version);
  }
  return [...rows.values()].sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
}

/** Texte exact d'une version, tel qu'importé : c'est l'export (aller-retour sans perte). */
export async function formationSource(
  db: pg.Pool,
  id: string,
  version: string,
): Promise<string | null> {
  const res = await db.query<{ source: string }>(
    'SELECT source FROM pl_formation_versions WHERE formation_id = $1 AND version = $2',
    [id, version],
  );
  return res.rows[0]?.source ?? null;
}

/**
 * Retire une version de cette base (l'évaluation, après publication en production) : la
 * formation disparaît avec sa dernière version ; sinon, la version courante redevient la
 * plus haute qui reste.
 */
export async function removeVersion(db: pg.Pool, id: string, version: string): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`formation:${id}`]);
    await client.query(
      'DELETE FROM pl_formation_versions WHERE formation_id = $1 AND version = $2',
      [id, version],
    );
    const highest = await client.query<{ version: string }>(
      `SELECT version FROM pl_formation_versions WHERE formation_id = $1
       ORDER BY version_major DESC, version_minor DESC, version_patch DESC LIMIT 1`,
      [id],
    );
    if (highest.rows[0]) {
      await client.query(
        'UPDATE pl_formations SET current_version = $2, updated_at = now() WHERE id = $1',
        [id, highest.rows[0].version],
      );
    } else {
      await client.query('DELETE FROM pl_formations WHERE id = $1', [id]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function markCopiedToDemo(db: pg.Pool, id: string, version: string): Promise<void> {
  await db.query(
    `UPDATE pl_formation_versions SET copied_to_demo_at = now()
     WHERE formation_id = $1 AND version = $2`,
    [id, version],
  );
}
