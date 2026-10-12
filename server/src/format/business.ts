import type { ReportItem } from '../../../shared/format.js';

/**
 * Contrôles métier du § 11, portés de tools/valider-formation.js (le validateur de
 * référence) : mêmes règles, mêmes cas, chemins identiques. Défensif : un document
 * mal formé (déjà signalé par le schéma) ne fait pas planter le contrôle.
 */
type Json = Record<string, unknown>;

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const obj = (value: unknown): Json =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {};
const str = (value: unknown): string => (typeof value === 'string' ? value : String(value));

export function businessChecks(document: unknown): {
  erreurs: ReportItem[];
  avertissements: ReportItem[];
} {
  const f = obj(document);
  const erreurs: ReportItem[] = [];
  const avertissements: ReportItem[] = [];
  const err = (chemin: string, message: string) => erreurs.push({ chemin, message });
  const warn = (chemin: string, message: string) => avertissements.push({ chemin, message });

  const references = list(f['references']).map(obj);
  const refIds = new Set(references.map((r) => r['id']));
  const used = new Set<unknown>();

  const duplicates = (values: unknown[], chemin: string) => {
    const seen = new Set<unknown>();
    for (const value of values) {
      if (seen.has(value)) err(chemin, `identifiant en double « ${str(value)} »`);
      seen.add(value);
    }
  };
  const cite = (ids: unknown, chemin: string) => {
    for (const id of list(ids)) {
      used.add(id);
      if (!refIds.has(id)) err(chemin, `référence inconnue « ${str(id)} »`);
    }
  };

  duplicates(
    references.map((r) => r['id']),
    'references',
  );
  const modules = list(f['modules']).map(obj);
  duplicates(
    modules.map((m) => m['id']),
    'modules',
  );
  list(f['glossaire']).forEach((g, i) => cite(obj(g)['references'], `glossaire[${i}]`));

  modules.forEach((m, mi) => {
    const activites = list(m['activites']).map(obj);
    duplicates(
      activites.map((a) => a['id']),
      `modules[${mi}].activites`,
    );
    activites.forEach((a, ai) => {
      const w = `modules[${mi}].activites[${ai}]`;
      switch (a['type']) {
        case 'lecon':
          list(a['blocs']).forEach((raw, bi) => {
            const b = obj(raw);
            if (b['type'] === 'approfondir') cite(b['references'], `${w}.blocs[${bi}]`);
            if (b['type'] === 'references') cite(b['ids'], `${w}.blocs[${bi}]`);
          });
          break;
        case 'diaporama':
          list(a['diapos']).forEach((raw, di) => {
            const approfondir = obj(raw)['approfondir'];
            if (approfondir) cite(obj(approfondir)['references'], `${w}.diapos[${di}]`);
          });
          break;
        case 'quiz': {
          const questions = list(a['questions']).map(obj);
          duplicates(
            questions.map((q) => q['id']),
            `${w}.questions`,
          );
          if (a['tirage'] && Number(a['tirage']) > questions.length) {
            err(w, 'tirage supérieur au nombre de questions');
          }
          questions.forEach((q, qi) => {
            const options = list(q['options']).map(obj);
            const ids = new Set(options.map((o) => o['id']));
            duplicates(
              options.map((o) => o['id']),
              `${w}.questions[${qi}].options`,
            );
            for (const bonne of list(q['bonnes'])) {
              if (!ids.has(bonne)) {
                err(`${w}.questions[${qi}]`, `bonne réponse « ${str(bonne)} » absente des options`);
              }
            }
            cite(q['references'], `${w}.questions[${qi}]`);
          });
          break;
        }
        case 'ordre':
          duplicates(
            list(a['elements']).map((e) => obj(e)['id']),
            `${w}.elements`,
          );
          break;
        case 'pratique': {
          // Format 1.1 (§ 6.8) : l'activité n'existe pas en 1.0.
          if (f['formatVersion'] === '1.0') {
            // Message identique à celui du validateur de référence (apostrophe droite comprise).
            err(w, "l'activité « pratique » exige formatVersion 1.1");
          }
          duplicates(
            list(a['verification']).map((v) => obj(v)['id']),
            `${w}.verification`,
          );
          duplicates(
            list(a['fichiers']).map((x) => obj(x)['nom']),
            `${w}.fichiers`,
          );
          cite(a['references'], w);
          if (a['solution']) cite(obj(a['solution'])['references'], `${w}.solution`);
          break;
        }
        case 'association': {
          const paires = list(a['paires']).map(obj);
          duplicates(
            paires.map((p) => p['id']),
            `${w}.paires`,
          );
          duplicates(
            paires.map((p) => p['droite']),
            `${w}.paires (colonne droite)`,
          );
          break;
        }
        case 'scenario': {
          const noeuds = obj(a['noeuds']);
          const debut = a['debut'];
          if (typeof debut !== 'string' || !(debut in noeuds)) {
            err(w, `nœud de début « ${str(debut)} » absent`);
          }
          const seen = new Set<string>();
          const stack = new Set<string>();
          const visit = (node: unknown): void => {
            if (node === 'fin') return;
            const key = str(node);
            if (!(key in noeuds)) {
              err(w, `nœud « ${key} » absent`);
              return;
            }
            if (stack.has(key)) {
              err(w, `boucle sur « ${key} »`);
              return;
            }
            if (seen.has(key)) return;
            seen.add(key);
            stack.add(key);
            for (const choix of list(obj(noeuds[key])['choix'])) visit(obj(choix)['suivant']);
            stack.delete(key);
          };
          visit(debut);
          for (const key of Object.keys(noeuds)) {
            if (!seen.has(key)) warn(w, `nœud « ${key} » inatteignable`);
          }
          if (!list(a['paliers']).some((p) => obj(p)['minPoints'] === 0)) {
            err(w, 'il faut un palier à 0 point');
          }
          break;
        }
      }
    });
  });

  for (const r of references) {
    if (!used.has(r['id'])) warn('references', `« ${str(r['id'])} » n'est citée nulle part`);
  }
  return { erreurs, avertissements };
}
