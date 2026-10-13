import { existsSync, writeFileSync } from 'node:fs';
import { SCENARIOS, VARIANTS } from './scenarios';

/**
 * Rapport de comparaison (visual-report/index.html) : pour chaque écran, la capture de
 * référence du prototype à côté de celle de l'application, puis les autres variantes.
 * Lancé par Playwright à la fin de `npm run visual`.
 */
export default function writeReport(): void {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // Chemins relatifs à visual-report/index.html ; vérifiés depuis la racine du dépôt.
  const img = (src: string, alt: string) =>
    existsSync(new URL(src, `file://${process.cwd()}/visual-report/`))
      ? `<a href="${esc(src)}"><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy"></a>`
      : `<p class="none">Pas de capture</p>`;

  const sections = SCENARIOS.map((s) => {
    const pairs = VARIANTS.map((v) => {
      const ref = s.refs[v];
      const refCell = ref
        ? `<figure><figcaption>Prototype · ${esc(ref)}</figcaption>${img(`../docs/ui/captures/${ref}.png`, `Prototype ${ref}`)}</figure>`
        : '';
      return `<div class="pair${ref ? '' : ' solo'}"><h3>${v}</h3>${refCell}<figure><figcaption>Application</figcaption>${img(`${v}/${s.id}.png`, `${s.titre} ${v}`)}</figure></div>`;
    }).join('');
    const ecarts = s.ecarts?.length
      ? `<ul>${s.ecarts.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`
      : '';
    return `<section id="${s.id}"><h2>${esc(s.id)} · ${esc(s.titre)}</h2>${ecarts}${pairs}</section>`;
  }).join('\n');

  const toc = SCENARIOS.map(
    (s) => `<li><a href="#${s.id}">${esc(s.id)} · ${esc(s.titre)}</a></li>`,
  ).join('');
  writeFileSync(
    'visual-report/index.html',
    `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Comparaison visuelle</title>
<style>
body{font:14px/1.5 system-ui,sans-serif;margin:24px;background:#f7f5f0;color:#14213d}
section{border-top:1px solid #ccc;padding:16px 0}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}
.pair h3{grid-column:1/-1;margin:0;font-size:13px;text-transform:uppercase;letter-spacing:.08em}
.pair.solo{grid-template-columns:1fr 1fr}
figure{margin:0}figcaption{font-size:12px;color:#555}
img{max-width:100%;border:1px solid #ccc;background:#fff}
.none{color:#999}
</style>
<h1>Comparaison visuelle : prototype et application</h1>
<p>Produit par <code>npm run visual</code>. Écarts connus et assumés listés sous chaque écran.</p>
<ol>${toc}</ol>
${sections}
</html>`,
  );
}
