// Validateur de référence du format 3S 1.0 et 1.1 : schéma JSON + contrôles métier (§ 11 de la spécification).
// Usage : node tools/valider-formation.js chemin/vers/ma.formation.json
// Prérequis : npm install ajv@8
// Sortie : rapport JSON {ok, erreurs, avertissements} ; code de sortie 1 en cas d'erreur.
const fs=require('fs'),path=require('path');const Ajv=require('ajv/dist/2020');
const schema=require(path.join(__dirname,'..','docs','format','formation.schema.json'));
if(!process.argv[2]){console.error('Usage : node tools/valider-formation.js <fichier.formation.json>');process.exit(2)}
const f=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const ajv=new Ajv({strict:true,allErrors:true});const v=ajv.compile(schema);
const errs=[],warn=[];
if(!v(f))v.errors.forEach(e=>errs.push(`${e.instancePath} ${e.message}`));
const refIds=new Set((f.references||[]).map(r=>r.id));
const dup=(arr,where)=>{const s=new Set();arr.forEach(x=>{if(s.has(x))errs.push(`${where}: identifiant en double « ${x} »`);s.add(x)})};
dup((f.references||[]).map(r=>r.id),'references');dup(f.modules.map(m=>m.id),'modules');
const used=new Set();const cite=(ids,where)=>(ids||[]).forEach(i=>{used.add(i);if(!refIds.has(i))errs.push(`${where}: référence inconnue « ${i} »`)});
(f.glossaire||[]).forEach((g,i)=>cite(g.references,`glossaire[${i}]`));
f.modules.forEach((m,mi)=>{dup(m.activites.map(a=>a.id),`modules[${mi}].activites`);
 m.activites.forEach((a,ai)=>{const w=`modules[${mi}].activites[${ai}]`;
  if(a.type==='lecon')a.blocs.forEach((b,bi)=>{if(b.type==='approfondir')cite(b.references,`${w}.blocs[${bi}]`);if(b.type==='references')cite(b.ids,`${w}.blocs[${bi}]`)});
  if(a.type==='diaporama')a.diapos.forEach((d,di)=>d.approfondir&&cite(d.approfondir.references,`${w}.diapos[${di}]`));
  if(a.type==='quiz'){dup(a.questions.map(q=>q.id),`${w}.questions`);
   if(a.tirage&&a.tirage>a.questions.length)errs.push(`${w}: tirage supérieur au nombre de questions`);
   a.questions.forEach((q,qi)=>{const o=new Set(q.options.map(x=>x.id));dup(q.options.map(x=>x.id),`${w}.questions[${qi}].options`);
    q.bonnes.forEach(b=>{if(!o.has(b))errs.push(`${w}.questions[${qi}]: bonne réponse « ${b} » absente des options`)});cite(q.references,`${w}.questions[${qi}]`)})}
  if(a.type==='ordre')dup(a.elements.map(e=>e.id),`${w}.elements`);
  if(a.type==='pratique'){if(f.formatVersion==='1.0')errs.push(`${w}: l'activité « pratique » exige formatVersion 1.1`);
   dup(a.verification.map(v=>v.id),`${w}.verification`);dup((a.fichiers||[]).map(x=>x.nom),`${w}.fichiers`);
   cite(a.references,w);if(a.solution)cite(a.solution.references,`${w}.solution`)}
  if(a.type==='association'){dup(a.paires.map(p=>p.id),`${w}.paires`);dup(a.paires.map(p=>p.droite),`${w}.paires (colonne droite)`)}
  if(a.type==='scenario'){const N=a.noeuds;if(!N[a.debut])errs.push(`${w}: nœud de début « ${a.debut} » absent`);
   const seen=new Set(),stack=new Set();const dfs=n=>{if(n==='fin')return;if(!N[n]){errs.push(`${w}: nœud « ${n} » absent`);return}
    if(stack.has(n)){errs.push(`${w}: boucle sur « ${n} »`);return}if(seen.has(n))return;seen.add(n);stack.add(n);N[n].choix.forEach(c=>dfs(c.suivant));stack.delete(n)};
   dfs(a.debut);Object.keys(N).forEach(k=>{if(!seen.has(k))warn.push(`${w}: nœud « ${k} » inatteignable`)});
   if(!a.paliers.some(p=>p.minPoints===0))errs.push(`${w}: il faut un palier à 0 point`)}
 })});
(f.references||[]).forEach(r=>{if(!used.has(r.id))warn.push(`references: « ${r.id} » n'est citée nulle part`)});
console.log(JSON.stringify({ok:errs.length===0,erreurs:errs,avertissements:warn},null,2));process.exit(errs.length?1:0);
