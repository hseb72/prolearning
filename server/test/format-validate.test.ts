import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateFormation } from '../src/format/validate.js';

/**
 * La plateforme doit rendre les mêmes verdicts que tools/valider-formation.js (CLAUDE.md,
 * « Documents de référence »). Chaque cas est passé aux deux validateurs : même verdict,
 * et mêmes constats métier (mêmes chemins, mêmes messages).
 */
const ROOT = join(import.meta.dirname, '..', '..');
const REFERENCE = join(ROOT, 'tools', 'valider-formation.js');
const FIXTURE = join(ROOT, 'fixtures', 'formations', 'togaf10-m1.formation.json');
const K8S = join(ROOT, 'fixtures', 'formations', 'kubernetes-fondamentaux.formation.json');

type Formation = Record<string, any>;
const base = (): Formation => JSON.parse(readFileSync(FIXTURE, 'utf8'));
const activityIndex = (f: Formation, type: string) =>
  f['modules'][0].activites.findIndex((a: Formation) => a['type'] === type);

/** Chaque cas : un nom et une transformation de la formation exemple (ou un contenu brut). */
const CASES: [string, (f: Formation) => Formation | string][] = [
  ['formation exemple', (f) => f],
  ['propriété obligatoire absente', (f) => (delete f['droits'], f)],
  ['propriété inconnue', (f) => ({ ...f, inconnue: 1 })],
  ['version de format inconnue', (f) => ({ ...f, formatVersion: '2.0' })],
  ['identifiant non conforme', (f) => ({ ...f, id: 'TOGAF 10' })],
  ['version non sémantique', (f) => ({ ...f, version: '1.0' })],
  ['modules en double', (f) => ({ ...f, modules: [f['modules'][0], f['modules'][0]] })],
  [
    'activités en double',
    (f) => {
      const activites = f['modules'][0].activites;
      activites[1] = { ...activites[1], id: activites[0].id };
      return f;
    },
  ],
  [
    'référence citée inconnue',
    (f) => {
      f['glossaire'] = [
        ...(f['glossaire'] ?? []),
        { terme: 'X', definition: 'x', references: ['inconnue'] },
      ];
      return f;
    },
  ],
  [
    'référence déclarée jamais citée',
    (f) => {
      const ref = { ...f['references'][0], id: 'jamais-citee' };
      f['references'] = [...f['references'], ref];
      return f;
    },
  ],
  [
    'bonne réponse absente des options',
    (f) => {
      f['modules'][0].activites[activityIndex(f, 'quiz')].questions[0].bonnes = ['zz'];
      return f;
    },
  ],
  [
    'tirage supérieur au nombre de questions',
    (f) => {
      const quiz = f['modules'][0].activites[activityIndex(f, 'quiz')];
      quiz.tirage = quiz.questions.length + 1;
      return f;
    },
  ],
  [
    'nœud de début absent',
    (f) => {
      f['modules'][0].activites[activityIndex(f, 'scenario')].debut = 'absent';
      return f;
    },
  ],
  [
    'boucle dans un scénario',
    (f) => {
      const s = f['modules'][0].activites[activityIndex(f, 'scenario')];
      const first = Object.keys(s.noeuds)[0]!;
      s.noeuds[first].choix[0].suivant = first;
      return f;
    },
  ],
  [
    'nœud inatteignable',
    (f) => {
      const s = f['modules'][0].activites[activityIndex(f, 'scenario')];
      s.noeuds['orphelin'] = {
        texte: 'Seul.',
        choix: [{ texte: 'Fin', points: 0, retour: 'ok', suivant: 'fin' }],
      };
      return f;
    },
  ],
  [
    'pas de palier à 0 point',
    (f) => {
      const s = f['modules'][0].activites[activityIndex(f, 'scenario')];
      s.paliers = s.paliers.filter((p: Formation) => p['minPoints'] !== 0);
      return f;
    },
  ],
  [
    'association : colonne droite en double',
    (f) => {
      const a = f['modules'][0].activites[activityIndex(f, 'association')];
      a.paires[1].droite = a.paires[0].droite;
      return f;
    },
  ],
  [
    'activité au type incohérent',
    (f) => {
      f['modules'][0].activites[0].type = 'quiz';
      return f;
    },
  ],
  ['JSON invalide', () => '{ "format": "3s-formation", '],
  ['fichier avec BOM', (f) => '﻿' + JSON.stringify(f)],
];

/** Format 1.1 : cas propres à l'activité `pratique`, sur la formation Kubernetes. */
const k8s = (): Formation => JSON.parse(readFileSync(K8S, 'utf8'));
const pratique = (f: Formation): Formation => {
  for (const m of f['modules']) {
    const found = m.activites.find((a: Formation) => a['type'] === 'pratique');
    if (found) return found;
  }
  throw new Error('Aucune activité pratique dans la formation Kubernetes.');
};
const CASES_1_1: [string, (f: Formation) => Formation | string][] = [
  ['formation Kubernetes (1.1)', (f) => f],
  ['pratique dans une formation 1.0', (f) => ({ ...f, formatVersion: '1.0' })],
  [
    'pratique : vérifications en double',
    (f) => {
      const p = pratique(f);
      p.verification = [...p.verification, p.verification[0]];
      return f;
    },
  ],
  [
    'pratique : fichiers en double',
    (f) => {
      const p = pratique(f);
      p.fichiers = [
        { nom: 'a.yaml', contenu: 'x' },
        { nom: 'a.yaml', contenu: 'y' },
      ];
      return f;
    },
  ],
  [
    'pratique : référence inconnue',
    (f) => {
      pratique(f).references = ['inconnue'];
      return f;
    },
  ],
  [
    'pratique : référence inconnue dans la solution',
    (f) => {
      pratique(f).solution = { titre: 'Solution', markdown: 'x', references: ['absente'] };
      return f;
    },
  ],
  [
    'pratique : chemin de fichier qui remonte',
    (f) => {
      pratique(f).fichiers = [{ nom: '../secret.yaml', contenu: 'x' }];
      return f;
    },
  ],
  [
    'pratique : sans vérification',
    (f) => {
      pratique(f).verification = [];
      return f;
    },
  ],
];

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'pl-format-'));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Verdict et constats du validateur de référence (un plantage vaut refus). */
function reference(file: string): { ok: boolean; lines: string[] } {
  try {
    const out = execFileSync(process.execPath, [REFERENCE, file], {
      encoding: 'utf8',
      stdio: 'pipe',
      // Le validateur de référence charge ajv : celui de l'API suffit (la CI de l'API
      // n'installe pas les dépendances de la racine).
      env: { ...process.env, NODE_PATH: join(ROOT, 'server', 'node_modules') },
    });
    const report = JSON.parse(out) as { erreurs: string[]; avertissements: string[] };
    return { ok: true, lines: [...report.erreurs, ...report.avertissements] };
  } catch (err) {
    const stdout = (err as { stdout?: string }).stdout ?? '';
    try {
      const report = JSON.parse(stdout) as { erreurs: string[]; avertissements: string[] };
      return { ok: false, lines: [...report.erreurs, ...report.avertissements] };
    } catch {
      return { ok: false, lines: [] };
    }
  }
}

describe('validation du format, à parité avec le validateur de référence', () => {
  it.each([
    ...CASES.map(([name, transform]) => [name, transform, base] as const),
    ...CASES_1_1.map(([name, transform]) => [name, transform, k8s] as const),
  ])('%s', (name, transform, load) => {
    const result = transform(load());
    const content = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    const file = join(dir, `${name.replace(/\W+/g, '-')}.formation.json`);
    writeFileSync(file, content, 'utf8');

    const ours = validateFormation(readFileSync(file));
    const ref = reference(file);
    expect(ours.ok).toBe(ref.ok);
    if (!ours.ok) expect(ours.erreurs.length).toBeGreaterThan(0);

    // Constats métier : ceux du validateur de référence qui ne viennent pas du schéma
    // (les siens commencent par un pointeur JSON ou une espace) se retrouvent à l'identique.
    const business = ref.lines.filter((line) => !/^[/ ]/.test(line));
    const ourLines = [...ours.erreurs, ...ours.avertissements].map(
      (item) => `${item.chemin}: ${item.message}`,
    );
    for (const line of business) expect(ourLines).toContain(line);
  });

  it('donne des chemins au style du format et des messages en français', () => {
    const f = base();
    f['modules'][0].activites[0].type = 'quiz';
    delete f['droits'];
    const report = validateFormation(JSON.stringify(f));
    expect(report.erreurs).toContainEqual({ chemin: '', message: 'requiert la propriété droits' });
    // Une activité mal typée ne produit que les écarts à SA variante, pas aux sept.
    const activity = report.erreurs.filter((e) => e.chemin.startsWith('modules[0].activites[0]'));
    expect(activity).toEqual([
      { chemin: 'modules[0].activites[0]', message: 'requiert la propriété questions' },
      {
        chemin: 'modules[0].activites[0]',
        message: 'ne doit pas contenir de propriétés additionnelles : « blocs »',
      },
    ]);
  });

  it('refuse une version de format inconnue avec un message explicite (§ 13)', () => {
    const report = validateFormation(JSON.stringify({ ...base(), formatVersion: '2.0' }));
    expect(report.ok).toBe(false);
    expect(report.erreurs[0]).toEqual({
      chemin: 'formatVersion',
      message: 'Version de format « 2.0 » inconnue de la plateforme (versions lues : 1.0, 1.1).',
    });
    expect(report.formation?.id).toBe('togaf10');
  });

  it('refuse un fichier trop volumineux ou mal encodé', () => {
    expect(validateFormation(Buffer.alloc(10 * 1024 * 1024 + 1, 32)).erreurs[0]!.message).toMatch(
      /trop volumineux/,
    );
    expect(validateFormation(Buffer.from([0x7b, 0xff, 0x7d])).erreurs[0]!.message).toMatch(/UTF-8/);
  });

  it('signale sans bloquer le HTML brut et les liens non http(s) (§ 9)', () => {
    const f = base();
    f['resume'] = 'Voir <b>ceci</b> et [ce lien](javascript:alert(1)).';
    const report = validateFormation(JSON.stringify(f));
    expect(report.ok).toBe(true);
    expect(report.avertissements.filter((w) => w.chemin === 'resume')).toHaveLength(2);
  });
});
