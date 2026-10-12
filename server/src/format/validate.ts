import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import {
  MAX_FORMATION_BYTES,
  SUPPORTED_FORMAT_VERSIONS,
  type ReportItem,
  type ValidationReport,
} from '../../../shared/format.js';
import { businessChecks } from './business.js';
import { pointerToPath } from './paths.js';

// Paquet CommonJS dont les types ne décrivent pas l'export par défaut : chargé tel quel.
const localizeFr = createRequire(import.meta.url)('ajv-i18n/localize/fr') as (
  errors: ErrorObject[] | null | undefined,
) => void;

/** Schéma du format, cherché en remontant depuis ce module (sources ou dist). */
function schemaFile(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (dir !== dirname(dir)) {
    const candidate = join(dir, 'docs', 'format', 'formation.schema.json');
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  throw new Error('Schéma docs/format/formation.schema.json introuvable.');
}

let compiled: { validate: ValidateFunction; schema: Record<string, unknown> } | null = null;

function validator() {
  if (!compiled) {
    const schema = JSON.parse(readFileSync(schemaFile(), 'utf8')) as Record<string, unknown>;
    // Mêmes options que le validateur de référence (tools/valider-formation.js), plus
    // `verbose`, qui n'influe pas sur le verdict : il donne le sous-schéma de chaque
    // erreur, pour retrouver la variante d'un `oneOf` dont elle vient.
    const ajv = new Ajv2020.default({ strict: true, allErrors: true, verbose: true });
    compiled = { validate: ajv.compile(schema), schema };
  }
  return compiled;
}

/**
 * Valide un fichier `.formation.json` tel que déposé : encodage, JSON, version du format,
 * schéma, puis contrôles métier. Le verdict (`ok`) est celui du validateur de référence ;
 * les messages sont en français et les chemins au style du § 11.
 */
export function validateFormation(source: Buffer | string): ValidationReport {
  const bytes = typeof source === 'string' ? Buffer.from(source, 'utf8') : source;
  const fail = (message: string, chemin = ''): ValidationReport => ({
    ok: false,
    erreurs: [{ chemin, message }],
    avertissements: [],
  });

  if (bytes.length > MAX_FORMATION_BYTES) {
    return fail('Fichier trop volumineux : 10 Mo au plus (§ 1 du format).');
  }
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return fail(
      'Encodage : le fichier commence par une marque d’ordre (BOM). Enregistrez-le en UTF-8 sans BOM.',
    );
  }
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (text.includes('�')) {
    return fail('Encodage : le fichier n’est pas en UTF-8 valide.');
  }

  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch (err) {
    return fail(`JSON invalide : ${(err as Error).message}`);
  }

  const root = (document && typeof document === 'object' ? document : {}) as Record<
    string,
    unknown
  >;
  const summary =
    typeof root['id'] === 'string' && typeof root['version'] === 'string'
      ? { id: root['id'], version: root['version'], titre: String(root['titre'] ?? root['id']) }
      : undefined;

  // § 13 : une version de format inconnue est refusée avec un message explicite.
  const formatVersion = root['formatVersion'];
  if (
    root['format'] === '3s-formation' &&
    typeof formatVersion === 'string' &&
    !(SUPPORTED_FORMAT_VERSIONS as readonly string[]).includes(formatVersion)
  ) {
    return {
      ...fail(
        `Version de format « ${formatVersion} » inconnue de la plateforme (versions lues : ${SUPPORTED_FORMAT_VERSIONS.join(', ')}).`,
        'formatVersion',
      ),
      formation: summary,
    };
  }

  const { validate, schema } = validator();
  const erreurs: ReportItem[] = [];
  if (!validate(document)) {
    const errors = relevantErrors(validate.errors ?? [], document, schema);
    localizeFr(errors);
    erreurs.push(...errors.map(toItem));
  }
  const business = businessChecks(document);
  erreurs.push(...business.erreurs);
  const avertissements = [...business.avertissements, ...contentWarnings(document)];

  return { ok: erreurs.length === 0, erreurs, avertissements, formation: summary };
}

function toItem(error: ErrorObject): ReportItem {
  let message = error.message ?? 'valeur invalide';
  const params = error.params as Record<string, unknown>;
  if (error.keyword === 'additionalProperties')
    message += ` : « ${String(params['additionalProperty'])} »`;
  if (error.keyword === 'enum') {
    message += ` : ${(params['allowedValues'] as unknown[]).map((v) => `« ${String(v)} »`).join(', ')}`;
  }
  if (error.keyword === 'const') message += ` : « ${String(params['allowedValue'])} »`;
  if (error.keyword === 'oneOf')
    message = 'ne correspond à aucune forme admise pour ce type d’élément';
  return { chemin: pointerToPath(error.instancePath), message };
}

/**
 * Les activités et les blocs sont des `oneOf` discriminés par `type` : ajv signale les
 * écarts à CHAQUE variante, ce qui noie le vrai problème. Pour chaque `oneOf` en échec,
 * on ne garde que les erreurs de la variante qui correspond au `type` de l'élément.
 * Le verdict ne change pas : s'il ne reste rien pour l'élément, l'erreur `oneOf` reste.
 */
function relevantErrors(
  errors: ErrorObject[],
  document: unknown,
  schema: Record<string, unknown>,
): ErrorObject[] {
  const dropped = new Set<ErrorObject>();
  for (const failure of errors.filter((e) => e.keyword === 'oneOf')) {
    // Le chemin de schéma d'ajv est relatif à la définition référencée : on part du
    // sous-schéma lui-même (option `verbose`).
    const branches = (failure.parentSchema as Record<string, unknown> | undefined)?.['oneOf'];
    if (!Array.isArray(branches)) continue;
    const owner = at(document, failure.instancePath) as Record<string, unknown> | undefined;
    const type = owner?.['type'];
    // Chaque variante, et l'ensemble des sous-schémas qui lui appartiennent.
    const variants = branches.map((branch) => {
      const node = branch as Record<string, unknown>;
      const root = typeof node['$ref'] === 'string' ? resolve(schema, node['$ref']) : node;
      return { nodes: subschemas(root), type: branchType(schema, node) };
    });
    if (!variants.some((v) => v.type === type)) continue;
    let remaining = 0;
    for (const error of errors) {
      if (error === failure || !isWithin(error.instancePath, failure.instancePath)) continue;
      const variant = variants.find((v) => v.nodes.has(error.parentSchema));
      if (!variant) continue;
      if (variant.type === type) remaining++;
      else dropped.add(error);
    }
    if (remaining > 0) dropped.add(failure);
  }
  return errors.filter((error) => !dropped.has(error));
}

/** Sous-schémas d'une variante (sans suivre les `$ref`, qui mènent hors d'elle). */
function subschemas(root: unknown): Set<unknown> {
  const nodes = new Set<unknown>();
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object' || nodes.has(node)) return;
    nodes.add(node);
    for (const child of Object.values(node)) walk(child);
  };
  walk(root);
  return nodes;
}

function isWithin(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function at(document: unknown, pointer: string): unknown {
  return pointer
    .split('/')
    .slice(1)
    .reduce<unknown>(
      (node, key) =>
        (node as Record<string, unknown> | undefined)?.[
          key.replace(/~1/g, '/').replace(/~0/g, '~')
        ],
      document,
    );
}

function resolve(schema: Record<string, unknown>, pointer: string): unknown {
  return pointer
    .replace(/^#/, '')
    .split('/')
    .filter(Boolean)
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], schema);
}

/** Valeur de `type` attendue par une variante (directement ou via son `$ref`). */
function branchType(schema: Record<string, unknown>, branch: unknown): string | undefined {
  let node = branch as Record<string, unknown> | undefined;
  if (node && typeof node['$ref'] === 'string') {
    node = resolve(schema, node['$ref']) as Record<string, unknown> | undefined;
  }
  const props = node?.['properties'] as Record<string, Record<string, unknown>> | undefined;
  const constant = props?.['type']?.['const'];
  return typeof constant === 'string' ? constant : undefined;
}

/**
 * Avertissements sur le contenu (§ 9) : HTML brut et liens non http(s). Ils ne bloquent
 * pas l'import — le validateur de référence ne les refuse pas — mais le lecteur les
 * neutralise à l'affichage.
 */
function contentWarnings(document: unknown): ReportItem[] {
  const warnings: ReportItem[] = [];
  const walk = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      if (/<\/?[a-zA-Z][^>]*>/.test(node)) {
        warnings.push({ chemin: path, message: 'HTML brut : il sera ignoré à l’affichage (§ 9).' });
      }
      for (const [, target] of node.matchAll(/\]\(\s*<?([^)\s>]+)/g)) {
        if (!/^(https?:\/\/|assets\/|#)/i.test(target!)) {
          warnings.push({
            chemin: path,
            message: `Lien « ${target} » : seuls les liens http(s) sont acceptés (§ 9), il sera neutralisé.`,
          });
        }
      }
    } else if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
    } else if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) walk(value, path ? `${path}.${key}` : key);
    }
  };
  walk(document, '');
  return warnings;
}
