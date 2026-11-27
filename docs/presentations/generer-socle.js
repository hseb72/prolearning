// Présentation « Du dépôt à la production en une semaine » : standards, patterns et socle.
// Usage : node generer-socle.js <sortie.pptx> (ou npm run socle)
const fs = require('fs');
const pptxgen = require('pptxgenjs');
const JSZip = require('jszip');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');
const fa = require('react-icons/fa');

const output = process.argv[2] ?? 'socle.pptx';

const THEME = {
  name: '3S - Socle et patterns',
  headFontFace: 'Cambria',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: '14213D',
    lt1: 'FFFFFF',
    dk2: '24345C',
    lt2: 'F7F5F0',
    accent1: 'E07A2E',
    accent2: 'AA5118',
    accent3: '2E7958',
    accent4: '5B6478',
    accent5: 'E4DFD3',
    accent6: 'F3D9C4',
    hlink: 'AA5118',
    folHlink: '7A3A10',
  },
};

async function applyTheme(file, theme) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file), { createFolders: false });
  const part = 'ppt/theme/theme1.xml';
  const esc = (v) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const slots = [
    'dk1',
    'lt1',
    'dk2',
    'lt2',
    'accent1',
    'accent2',
    'accent3',
    'accent4',
    'accent5',
    'accent6',
    'hlink',
    'folHlink',
  ];
  const scheme =
    `<a:clrScheme name="${esc(theme.name)}">` +
    slots.map((k) => `<a:${k}><a:srgbClr val="${theme.colors[k]}"/></a:${k}>`).join('') +
    '</a:clrScheme>';
  const xml = (await zip.file(part).async('string'))
    .replace(/<a:clrScheme[^>]*>[\s\S]*?<\/a:clrScheme>/, scheme)
    .replace(/(<a:theme [^>]*name=")[^"]*"/, `$1${esc(theme.name)}"`)
    .replace(/(<a:fontScheme name=")[^"]*"/, `$1${esc(theme.name)}"`);
  zip.file(part, xml);
  // Archive recopiée fichier par fichier, sans entrées de dossier : certains services en
  // ligne refusent de telles archives (supprimer un dossier, dans JSZip, vide aussi son contenu).
  const out = new JSZip();
  for (const [path, entry] of Object.entries(zip.files)) {
    if (!entry.dir) out.file(path, await entry.async('nodebuffer'), { createFolders: false });
  }
  fs.writeFileSync(file, await out.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.title = 'Du dépôt à la production en une semaine';
pres.subject = "Standards, patterns d'architecture et socle d'hébergement des applications";
pres.author = '3S';
pres.company = '3S';
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const NAVY = C.text1,
  WHITE = C.background1,
  PAPER = C.background2,
  ORANGE = C.accent1,
  RUST = C.accent2,
  GREEN = C.accent3,
  SLATE = C.accent4,
  LINE = C.accent5,
  PEACH = C.accent6;

async function icon(Component, hex = 'FFFFFF') {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Component, { color: '#' + hex, size: '256' }),
  );
  return 'image/png;base64,' + (await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64');
}

// ---------- Mises en page ----------
const FOOTER = 'Du dépôt à la production en une semaine';
pres.defineSlideMaster({
  title: 'Titre',
  background: { color: NAVY },
  objects: [
    { rect: { x: 0, y: 4.95, w: 10, h: 0.675, fill: { color: '0E1830' } } },
    {
      placeholder: {
        options: {
          name: 'eyebrow',
          type: 'body',
          x: 0.6,
          y: 0.95,
          w: 8.8,
          h: 0.35,
          fontSize: 13,
          bold: true,
          color: ORANGE,
          charSpacing: 2,
          margin: 0,
        },
        text: '',
      },
    },
    {
      placeholder: {
        options: {
          name: 'title',
          type: 'title',
          align: 'left',
          x: 0.6,
          y: 1.35,
          w: 8.8,
          h: 1.6,
          fontSize: 38,
          color: WHITE,
          valign: 'top',
          margin: 0,
        },
        text: '',
      },
    },
    {
      placeholder: {
        options: {
          name: 'subtitle',
          type: 'body',
          x: 0.6,
          y: 3.05,
          w: 8.8,
          h: 0.7,
          fontSize: 17,
          color: PEACH,
          italic: true,
          valign: 'top',
          margin: 0,
        },
        text: '',
      },
    },
  ],
});
pres.defineSlideMaster({
  title: 'Section',
  background: { color: NAVY },
  objects: [
    {
      placeholder: {
        options: {
          name: 'eyebrow',
          type: 'body',
          x: 0.6,
          y: 1.5,
          w: 8.8,
          h: 0.4,
          fontSize: 14,
          bold: true,
          color: ORANGE,
          charSpacing: 2,
          margin: 0,
        },
        text: '',
      },
    },
    {
      placeholder: {
        options: {
          name: 'title',
          type: 'title',
          align: 'left',
          x: 0.6,
          y: 1.95,
          w: 8.8,
          h: 1.1,
          fontSize: 34,
          color: WHITE,
          valign: 'top',
          margin: 0,
        },
        text: '',
      },
    },
    {
      placeholder: {
        options: {
          name: 'body',
          type: 'body',
          x: 0.6,
          y: 3.1,
          w: 8.2,
          h: 1.2,
          fontSize: 16,
          color: PEACH,
          valign: 'top',
          margin: 0,
        },
        text: '',
      },
    },
    {
      text: {
        text: FOOTER,
        options: { x: 0.6, y: 5.18, w: 7, h: 0.25, fontSize: 9, color: PEACH, margin: 0 },
      },
    },
  ],
  slideNumber: { x: 9.0, y: 5.18, w: 0.5, h: 0.25, fontSize: 9, color: PEACH, align: 'right' },
});
pres.defineSlideMaster({
  title: 'Contenu',
  background: { color: PAPER },
  objects: [
    {
      placeholder: {
        options: {
          name: 'eyebrow',
          type: 'body',
          x: 0.5,
          y: 0.3,
          w: 9,
          h: 0.3,
          fontSize: 11,
          bold: true,
          color: RUST,
          charSpacing: 1.5,
          margin: 0,
        },
        text: '',
      },
    },
    {
      placeholder: {
        options: {
          name: 'title',
          type: 'title',
          align: 'left',
          x: 0.5,
          y: 0.58,
          w: 9,
          h: 0.7,
          fontSize: 25,
          color: NAVY,
          valign: 'top',
          margin: 0,
        },
        text: '',
      },
    },
    { line: { x: 0.5, y: 5.12, w: 9, h: 0, line: { color: LINE, width: 0.75 } } },
    {
      text: {
        text: FOOTER,
        options: { x: 0.5, y: 5.2, w: 7, h: 0.25, fontSize: 9, color: SLATE, margin: 0 },
      },
    },
  ],
  slideNumber: { x: 9.0, y: 5.2, w: 0.5, h: 0.28, fontSize: 9, color: SLATE, align: 'right' },
});

// ---------- Briques ----------
let n = 0;
const id = (s) => `${s}-${++n}`;
function text(slide, value, opts) {
  slide.addText(value, {
    isTextBox: true,
    margin: 0,
    color: NAVY,
    fontSize: 12,
    valign: 'top',
    objectName: id('texte'),
    ...opts,
  });
}
function card(slide, x, y, w, h, fill = WHITE, line = LINE) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: line, width: 0.75 },
    objectName: id('carte'),
  });
}
async function badge(slide, x, y, d, Icon, fill = ORANGE) {
  slide.addShape(pres.shapes.OVAL, {
    x,
    y,
    w: d,
    h: d,
    fill: { color: fill },
    line: { type: 'none' },
    objectName: id('pastille'),
  });
  const p = d * 0.24;
  slide.addImage({
    data: await icon(Icon),
    x: x + p,
    y: y + p,
    w: d - 2 * p,
    h: d - 2 * p,
    objectName: id('icone'),
    altText: '',
  });
}
function arrow(slide, x, y, w, h, color = SLATE) {
  slide.addShape(pres.shapes.LINE, {
    x,
    y,
    w,
    h,
    line: { color, width: 1.5, endArrowType: 'triangle' },
    objectName: id('fleche'),
  });
}
function box(slide, x, y, w, h, label, opts = {}) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x,
    y,
    w,
    h,
    rectRadius: 0.06,
    fill: { color: opts.fill ?? WHITE },
    line: { color: opts.line ?? LINE, width: 1 },
    objectName: id('boite'),
  });
  text(slide, label, {
    x: x + 0.05,
    y,
    w: w - 0.1,
    h,
    fontSize: opts.size ?? 10.5,
    align: 'center',
    valign: 'middle',
    color: opts.color ?? NAVY,
    bold: opts.bold ?? false,
  });
}
const bullets = (items, space = 5) =>
  items.map((t, i) => ({
    text: t,
    options: { bullet: { indent: 12 }, paraSpaceAfter: space, breakLine: i < items.length - 1 },
  }));

function content(section, eyebrow, title) {
  const s = pres.addSlide({ masterName: 'Contenu', sectionTitle: section });
  s.addText(eyebrow, { placeholder: 'eyebrow' });
  s.addText(title, { placeholder: 'title' });
  return s;
}
function divider(section, eyebrow, title, body) {
  pres.addSection({ title: section });
  const s = pres.addSlide({ masterName: 'Section', sectionTitle: section });
  s.addText(eyebrow, { placeholder: 'eyebrow' });
  s.addText(title, { placeholder: 'title' });
  s.addText(body, { placeholder: 'body' });
  return s;
}

async function build() {
  // ===== Ouverture =====
  pres.addSection({ title: 'Ouverture' });
  let s = pres.addSlide({ masterName: 'Titre', sectionTitle: 'Ouverture' });
  s.addText('STANDARDS · PATTERNS · SOCLE', { placeholder: 'eyebrow' });
  s.addText('Du dépôt à la production en une semaine', { placeholder: 'title' });
  s.addText(
    "Comment des standards, des patterns d'architecture et un socle d'hébergement rendent le déploiement des applications reproductible",
    { placeholder: 'subtitle' },
  );
  text(s, 'platform-patterns · homelab-platform · les applications', {
    x: 0.6,
    y: 5.12,
    w: 8,
    h: 0.35,
    fontSize: 12,
    bold: true,
    color: WHITE,
    valign: 'middle',
  });
  s.addNotes(
    "Objet de la séance : raconter la démarche qui permet aujourd'hui à une petite application d'aller du développement à la production en une semaine, et montrer ce qui le prouve.\n\n" +
      "Trois dépôts portent l'histoire : platform-patterns (la définition des patterns), homelab-platform (l'infrastructure d'accueil) et les dépôts des applications (la consommation).\n\n" +
      "Selon le public : les décideurs peuvent s'arrêter aux actes 1, 2, 7 et 8 ; les équipes applicatives approfondissent les actes 3 et 8 ; les opérateurs les actes 4 et 5.",
  );

  // La promesse
  s = content('Ouverture', 'LA PROMESSE', 'Du développement à la production en une semaine');
  const stats = [
    ['1 semaine', 'pour une petite application, du premier commit à la production'],
    ['7', 'applications hébergées sur le même socle'],
    ['18 h', 'pour ProLearning, du premier commit à la première mise en production'],
  ];
  for (const [i, [big, small]] of stats.entries()) {
    const x = 0.5 + i * 3.05;
    card(s, x, 1.5, 2.85, 2.6, i === 1 ? NAVY : WHITE, i === 1 ? NAVY : LINE);
    text(s, big, {
      x: x + 0.25,
      y: 1.75,
      w: 2.4,
      h: 0.9,
      fontSize: 34,
      bold: true,
      fontFace: 'Cambria',
      color: ORANGE,
    });
    text(s, small, {
      x: x + 0.25,
      y: 2.75,
      w: 2.4,
      h: 1.2,
      fontSize: 13,
      color: i === 1 ? WHITE : SLATE,
    });
  }
  text(
    s,
    "Ce n'est pas une performance ponctuelle : c'est le résultat d'une démarche, que cette présentation déroule étape par étape.",
    { x: 0.5, y: 4.35, w: 9, h: 0.5, fontSize: 13, italic: true, color: RUST },
  );
  s.addNotes(
    'Annoncer la promesse dès le début, puis la prouver à la fin (acte 8).\n\n' +
      'Les 7 applications : xpms (gestion locative, pattern dedicated), TreasureHunters, findout, mtgwars, wh4chars, ProLearning, ludi-tabulares.\n\n' +
      "Les 18 h de ProLearning sont du temps calendaire, pas de l'effort, et le développement a été assisté par Claude Code. Le dire : c'est aussi une conséquence de la démarche, car des standards et des patterns bien décrits permettent à un assistant de produire vite un déploiement conforme. « Une semaine » reste le bon message général pour une équipe classique.",
  );

  // L'objectif d'origine
  s = content('Ouverture', 'LA GENÈSE', 'Trois exigences de départ');
  const goals = [
    [
      fa.FaCloud,
      'Externalisée, mais simple',
      "Une infrastructure d'accueil hors de l'entreprise, volontairement sobre : un cluster k3s, une seule adresse IP publique, tout décrit dans Git.",
    ],
    [
      fa.FaShieldAlt,
      'La sécurité la plus stricte',
      'Isolation par défaut, aucun secret dans Git, conteneurs non privilégiés, pare-feu applicatif, images signées.',
    ],
    [
      fa.FaCubes,
      'Un maximum de standardisation',
      'Les mêmes briques et les mêmes façons de faire pour toutes les applications, pour mutualiser les savoir-faire.',
    ],
  ];
  for (const [i, [Icon, head, body]] of goals.entries()) {
    const x = 0.5 + i * 3.05;
    card(s, x, 1.45, 2.85, 3.45);
    await badge(s, x + 0.25, 1.7, 0.6, Icon, i === 1 ? GREEN : ORANGE);
    text(s, head, {
      x: x + 0.25,
      y: 2.45,
      w: 2.4,
      h: 0.65,
      fontSize: 15,
      bold: true,
      fontFace: 'Cambria',
    });
    text(s, body, { x: x + 0.25, y: 3.1, w: 2.4, h: 1.7, fontSize: 12, color: SLATE });
  }
  s.addNotes(
    'La genèse : pouvoir déployer des applications dans une infrastructure externalisée mais relativement simple, en appliquant la sécurité la plus stricte et en respectant un maximum de standardisation.\n\n' +
      "Ces trois exigences se tiennent : la simplicité rend la sécurité vérifiable, et la standardisation rend la simplicité tenable quand le nombre d'applications grandit.",
  );

  // La démarche
  s = content('Ouverture', 'LA DÉMARCHE', 'Sept étapes, chacune produit un résultat concret');
  const steps = [
    ['Standards technologiques', 'mutualiser les savoir-faire'],
    ["Patterns d'architecture", 'dedicated, shared'],
    ["Patterns d'implémentation", 'déploiement, sécurité, supervision'],
    ["Socle d'infrastructure", "l'accueil des architectures"],
    ['Du dépôt à la production', 'CI, CD, GitOps'],
    ['Applications pilotes', 'xpms, TreasureHunters'],
    ['Reproduction', 'la preuve par la répétition'],
  ];
  const sw = 9 / 7;
  s.addShape(pres.shapes.LINE, {
    x: 0.5 + sw / 2,
    y: 1.95,
    w: sw * 6,
    h: 0,
    line: { color: ORANGE, width: 2 },
    objectName: id('frise'),
  });
  for (const [i, [head, sub]] of steps.entries()) {
    const cx = 0.5 + sw * i + sw / 2;
    s.addShape(pres.shapes.OVAL, {
      x: cx - 0.3,
      y: 1.65,
      w: 0.6,
      h: 0.6,
      fill: { color: NAVY },
      line: { color: ORANGE, width: 2 },
      objectName: id('etape'),
    });
    text(s, String(i + 1), {
      x: cx - 0.3,
      y: 1.65,
      w: 0.6,
      h: 0.6,
      fontSize: 16,
      bold: true,
      color: WHITE,
      align: 'center',
      valign: 'middle',
      fontFace: 'Cambria',
    });
    text(s, head, {
      x: cx - sw / 2 + 0.02,
      y: 2.45,
      w: sw - 0.04,
      h: 0.75,
      fontSize: 10.5,
      bold: true,
      align: 'center',
      fontFace: 'Cambria',
    });
    text(s, sub, {
      x: cx - sw / 2 + 0.05,
      y: 3.2,
      w: sw - 0.1,
      h: 0.6,
      fontSize: 10,
      align: 'center',
      color: SLATE,
    });
  }
  card(s, 0.5, 4.05, 9, 0.85, WHITE);
  text(
    s,
    [
      { text: 'Les dépôts reproduisent la démarche : ', options: { bold: true } },
      {
        text: "platform-patterns = la définition (2-3) · homelab-platform = l'implémentation (4-5) · chaque dépôt d'application = la consommation (6-7).",
      },
    ],
    { x: 0.75, y: 4.15, w: 8.5, h: 0.65, fontSize: 12, valign: 'middle' },
  );
  s.addNotes(
    "C'est le plan de la présentation : un acte par étape, puis un acte sur la façon dont la démarche se corrige elle-même.\n\n" +
      "Insister sur l'encadré : la séparation en dépôts n'est pas une commodité, elle matérialise la démarche. Les patterns ne savent rien des applications ; le socle les accueille ; chaque application ne déclare que ce qui la concerne, chez elle.",
  );

  // ===== Acte 1 : standards =====
  divider(
    '1. Standards',
    'ACTE 1',
    'Des standards technologiques',
    'Choisir une fois les briques communes, pour que chaque savoir-faire acquis profite à toutes les applications.',
  );
  s = content(
    '1. Standards',
    'STANDARDS TECHNOLOGIQUES',
    'Une pile commune, des savoir-faire partagés',
  );
  const stack = [
    [fa.FaCode, 'Langage', 'TypeScript de bout en bout, un paquet partagé entre front et API'],
    [fa.FaDesktop, 'Front', 'Angular, servi par nginx non privilégié'],
    [fa.FaServer, 'API', 'Node.js (Fastify), validation zod, exposée via Kong'],
    [fa.FaDatabase, 'Données', 'PostgreSQL, migrations SQL versionnées ; MinIO ; Redis'],
    [fa.FaVial, 'Qualité', "Vitest, Playwright, audit d'accessibilité, CI à chaque PR"],
    [fa.FaShippingFast, 'Livraison', 'Images sur GHCR, chart Helm en OCI, Argo CD'],
  ];
  for (const [i, [Icon, head, body]] of stack.entries()) {
    const col = i % 3,
      row = Math.floor(i / 3);
    const x = 0.5 + col * 3.05,
      y = 1.45 + row * 1.75;
    card(s, x, y, 2.85, 1.6);
    await badge(s, x + 0.2, y + 0.2, 0.5, Icon);
    text(s, head, {
      x: x + 0.85,
      y: y + 0.22,
      w: 1.85,
      h: 0.45,
      fontSize: 15,
      bold: true,
      fontFace: 'Cambria',
      valign: 'middle',
    });
    text(s, body, { x: x + 0.2, y: y + 0.8, w: 2.5, h: 0.75, fontSize: 11, color: SLATE });
  }
  s.addNotes(
    "Le standard n'est pas une contrainte esthétique : c'est ce qui permet de reprendre le travail d'une application dans la suivante (Dockerfiles, workflows de CI, valeurs de déploiement, conventions de base de données).\n\n" +
      'Exemple concret : le dépôt de ProLearning a repris ses workflows de build et de promotion « same as treasurehunters ».\n\n' +
      "Une application peut s'écarter du standard, mais elle perd alors le bénéfice de la mutualisation : c'est un choix à justifier, pas un défaut.",
  );

  // ===== Acte 2 : patterns d'architecture =====
  divider(
    '2. Architecture',
    'ACTE 2',
    "Des patterns d'architecture reproductibles",
    'Deux modèles décrits une fois pour toutes : chaque application choisit le sien, sans réinventer son architecture.',
  );
  s = content('2. Architecture', "PATTERNS D'ARCHITECTURE", 'Deux patterns, un même chart');
  const pats = [
    [
      'dedicated',
      'Tout à soi',
      [
        'Ses propres namespaces : frontend, gateway, backend',
        'Sa propre gateway Kong',
        'Ses propres PostgreSQL, MinIO, Redis',
        'Isolation physique, cycle de vie indépendant',
      ],
      'Quand une application ne doit partager ni données ni panne.',
    ],
    [
      'shared',
      'Le socle mutualisé',
      [
        'Deux namespaces par application : ui-<app>, api-<app>',
        'Edge, Kong, Vault partagés',
        'Une base, un seau, un préfixe Redis par application',
        'Même isolation réseau, coût bien plus bas',
      ],
      'Quand le coût et la vitesse de mise en route dominent.',
    ],
  ];
  for (const [i, [name, sub, items, when]] of pats.entries()) {
    const x = 0.5 + i * 4.6;
    card(s, x, 1.45, 4.4, 3.45, i ? WHITE : WHITE);
    s.addShape(pres.shapes.RECTANGLE, {
      x,
      y: 1.45,
      w: 4.4,
      h: 0.6,
      fill: { color: i ? ORANGE : NAVY },
      line: { type: 'none' },
      objectName: id('bandeau'),
    });
    text(
      s,
      [{ text: name, options: { bold: true, fontFace: 'Consolas' } }, { text: `  ·  ${sub}` }],
      { x: x + 0.25, y: 1.45, w: 3.9, h: 0.6, fontSize: 15, color: WHITE, valign: 'middle' },
    );
    text(s, bullets(items, 4), { x: x + 0.25, y: 2.2, w: 3.95, h: 1.8, fontSize: 12 });
    text(s, when, {
      x: x + 0.25,
      y: 4.15,
      w: 3.95,
      h: 0.6,
      fontSize: 11.5,
      italic: true,
      color: RUST,
    });
  }
  s.addNotes(
    'Un seul chart Helm, « app », sert les deux patterns par une bascule mode: dedicated | shared.\n\n' +
      "L'idée forte du pattern shared : on ne mutualise que les moteurs avec état (PostgreSQL, MinIO, Redis). Chaque application garde ses namespaces, ses NetworkPolicies, sa base, son seau, son préfixe et ses routes : l'isolation du dedicated est conservée.\n\n" +
      'Source : platform-patterns, docs/patterns/dedicated.md et shared.md, ADR 0001.',
  );

  s = content('2. Architecture', 'CHOISIR', 'Les compromis, explicitement');
  const rows = [
    ['', 'dedicated', 'shared'],
    [
      'Isolation',
      'Physique : namespaces et moteurs à soi',
      'Namespaces, base, seau, préfixe et routes à soi ; moteurs mutualisés',
    ],
    [
      "Rayon d'impact",
      "Limité à l'application",
      "Limité à l'application côté réseau ; une panne d'un moteur partagé touche tout le monde",
    ],
    [
      'Coût',
      'Élevé : une pile complète par application',
      'Faible : un socle, des applications légères',
    ],
    [
      'Mise en route',
      'Déployer une pile complète',
      'Deux namespaces, déclarer les services utilisés, recevoir sa part',
    ],
    [
      'Exploitation',
      "L'application gère tout",
      "Le socle livre et maintient les outils ; l'application gère ce qui est à elle",
    ],
  ];
  s.addTable(
    rows.map((r, ri) =>
      r.map((c, ci) => ({
        text: c,
        options: {
          bold: ri === 0 || ci === 0,
          color: ri === 0 ? WHITE : NAVY,
          fill: {
            color: ri === 0 ? (ci === 2 ? 'E07A2E' : '14213D') : ci === 0 ? 'F3D9C4' : 'FFFFFF',
          },
          fontSize: ri === 0 ? 12 : 10.5,
          fontFace: ri === 0 && ci > 0 ? 'Consolas' : undefined,
          valign: 'middle',
          margin: [3, 6, 3, 6],
        },
      })),
    ),
    {
      x: 0.5,
      y: 1.42,
      w: 9,
      colW: [1.6, 3.3, 4.1],
      rowH: [0.38, 0.6, 0.6, 0.5, 0.6, 0.6],
      border: { type: 'solid', color: 'E4DFD3', pt: 0.75 },
      objectName: id('tableau'),
    },
  );
  s.addNotes(
    'Le tableau vient du catalogue des patterns (platform-patterns, docs/README.md).\n\n' +
      'Règle pratique : dedicated quand une base dédiée ou la localisation des données dominent ; shared quand le coût et la vitesse de mise en route dominent.\n\n' +
      'xpms reste en dedicated par choix : il garde ses propres moteurs embarqués dans sa release.',
  );

  s = content('2. Architecture', 'UN INVARIANT', "App → Pattern, jamais l'inverse");
  card(s, 0.5, 1.45, 9, 1.3, NAVY, NAVY);
  text(
    s,
    "Le dépôt des patterns ne contient aucune application : ni liste, ni nom d'hôte réel, ni secret. En le lisant, une application ne peut rien déduire du déploiement d'une autre.",
    {
      x: 0.8,
      y: 1.55,
      w: 8.4,
      h: 1.1,
      fontSize: 16,
      color: WHITE,
      fontFace: 'Cambria',
      italic: true,
      valign: 'middle',
    },
  );
  const inv = [
    [
      fa.FaTags,
      'Chaque application déclare son besoin chez elle',
      "Une étiquette par service utilisé sur son namespace api-<app> (platform-patterns.io/postgres-client…). Le service n'admet que les namespaces qui la portent.",
    ],
    [
      fa.FaBan,
      'Aucun registre central',
      "Pas de liste d'applications, pas d'ApplicationSet. Une seule exception assumée : les noms d'hôtes d'API, dans le namespace kong du socle.",
    ],
  ];
  for (const [i, [Icon, head, body]] of inv.entries()) {
    const x = 0.5 + i * 4.6;
    await badge(s, x, 3.0, 0.5, Icon, i ? RUST : ORANGE);
    text(s, head, {
      x: x + 0.65,
      y: 3.0,
      w: 3.75,
      h: 0.5,
      fontSize: 14,
      bold: true,
      fontFace: 'Cambria',
      valign: 'middle',
    });
    text(s, body, { x: x + 0.65, y: 3.55, w: 3.75, h: 1.4, fontSize: 11.5, color: SLATE });
  }
  s.addNotes(
    "C'est la règle qui rend la reproduction possible : ajouter une application ne demande pas de modifier les patterns, et ne demande presque rien au socle.\n\n" +
      "Retirer une étiquette ferme la porte correspondante : la tenance est réversible et vit chez l'application.\n\n" +
      "L'exception des hôtes d'API tient à Kubernetes : un Ingress ne peut viser qu'un Service de son propre namespace, et kong-proxy vit dans le namespace du socle.",
  );

  // ===== Acte 3 : patterns d'implémentation =====
  divider(
    '3. Implémentation',
    'ACTE 3',
    "Des patterns d'implémentation maîtrisés",
    'Déploiement, sécurité, supervision et observabilité sont dans le pattern : chaque application en hérite.',
  );
  s = content('3. Implémentation', 'LE CONTRAT', 'Un chart unique, versionné, signé');
  const contract = [
    [
      fa.FaFileCode,
      'Un contrat vérifiable',
      "values.schema.json décrit tout ce qu'une application peut régler ; la CI le vérifie à chaque rendu.",
    ],
    [
      fa.FaCodeBranch,
      'SemVer sur les valeurs',
      "MAJEUR = l'interface des valeurs change ; MINEUR = ajout optionnel ; CORRECTIF = sans impact.",
    ],
    [
      fa.FaBoxOpen,
      'Publié en OCI',
      'oci://ghcr.io/…/platform-patterns/app, une version par étiquette app-x.y.z.',
    ],
    [
      fa.FaSignature,
      'Signé avec cosign',
      'Signature sans clé, liée au workflow de publication, inscrite au journal de transparence.',
    ],
    [
      fa.FaThumbtack,
      'Version épinglée',
      'Chaque application choisit sa version ; un correctif se propage par montée de version, pas par copier-coller.',
    ],
  ];
  for (const [i, [Icon, head, body]] of contract.entries()) {
    const y = 1.45 + i * 0.72;
    await badge(s, 0.5, y + 0.05, 0.48, Icon, i === 3 ? GREEN : ORANGE);
    text(
      s,
      [
        { text: head + ' — ', options: { bold: true } },
        { text: body, options: { color: SLATE } },
      ],
      { x: 1.15, y, w: 8.3, h: 0.62, fontSize: 12.5, valign: 'middle' },
    );
  }
  s.addNotes(
    'Source : platform-patterns, CONTRIBUTING.md et docs/releasing.md.\n\n' +
      "La vérification de signature se fait avec cosign verify, en contrôlant l'identité du workflow de publication.\n\n" +
      'Conséquence pour une application : sa configuration de déploiement tient dans un fichier de valeurs et une Application Argo CD qui pointe une version précise du chart.',
  );

  s = content(
    '3. Implémentation',
    'SÉCURITÉ INTÉGRÉE',
    'Ce que chaque application reçoit sans y penser',
  );
  const sec = [
    [
      fa.FaProjectDiagram,
      'Isolation réseau',
      "NetworkPolicies refusées par défaut : seul l'edge atteint l'interface, seul Kong atteint l'API, l'API n'atteint que les services déclarés.",
    ],
    [
      fa.FaUserShield,
      'Conteneurs restreints',
      'Pod Security « restricted » : non-root, sans élévation de privilèges, toutes capacités retirées.',
    ],
    [
      fa.FaKey,
      'Secrets hors Git',
      'Référencés par leur nom seulement ; identifiants PostgreSQL dynamiques par pod via Vault.',
    ],
    [
      fa.FaFire,
      'Pare-feu applicatif',
      "ModSecurity et règles OWASP sur l'edge, avec TLS de bout en bout.",
    ],
    [
      fa.FaRoute,
      'Un seul point de contrôle',
      "Seul /api passe par Kong ; l'interface ne traverse jamais Kong, une API n'est jamais appelée en direct.",
    ],
    [
      fa.FaCertificate,
      "Chaîne d'approvisionnement",
      'Charts signés, versions épinglées, montées de version suivies par Renovate.',
    ],
  ];
  for (const [i, [Icon, head, body]] of sec.entries()) {
    const col = i % 3,
      row = Math.floor(i / 3);
    const x = 0.5 + col * 3.05,
      y = 1.45 + row * 1.75;
    card(s, x, y, 2.85, 1.6);
    await badge(s, x + 0.2, y + 0.2, 0.45, Icon, GREEN);
    text(s, head, {
      x: x + 0.78,
      y: y + 0.2,
      w: 1.95,
      h: 0.45,
      fontSize: 13,
      bold: true,
      fontFace: 'Cambria',
      valign: 'middle',
    });
    text(s, body, { x: x + 0.2, y: y + 0.75, w: 2.5, h: 0.82, fontSize: 10, color: SLATE });
  }
  s.addNotes(
    "La sécurité la plus stricte n'est pas demandée à chaque équipe : elle est rendue par le chart et par le socle.\n\n" +
      "Le WAF a d'abord tourné en mode observation (DetectionOnly) le temps de dépouiller les faux positifs : c'est la procédure documentée dans homelab-platform, edge/WAF.md.\n\n" +
      'Pour MinIO et les composants qui ne savent pas se reconnecter, le repli est un identifiant statique à rotation planifiée, avec redémarrage automatique (Reloader).',
  );

  s = content('3. Implémentation', 'SUPERVISION ET OBSERVABILITÉ', 'Mesurer sans rien réinventer');
  // Schéma : applications -> collecte -> stockage -> tableaux de bord / alertes
  box(s, 0.5, 1.7, 2.0, 0.9, 'Applications\nServiceMonitor\nPrometheusRule', { size: 10.5 });
  box(s, 0.5, 2.85, 2.0, 0.75, 'Nœuds et cluster\nexporters', { size: 10.5 });
  arrow(s, 2.5, 2.15, 0.6, 0.45);
  arrow(s, 2.5, 3.2, 0.6, -0.4);
  box(s, 3.1, 2.25, 1.8, 0.8, 'vmagent\n(collecte)', { fill: PEACH });
  arrow(s, 4.9, 2.65, 0.5, 0);
  box(s, 5.4, 2.25, 1.6, 0.8, 'VictoriaMetrics\n(stockage)', { fill: PEACH });
  arrow(s, 7.0, 2.45, 0.5, -0.5);
  arrow(s, 7.0, 2.85, 0.5, 0.5);
  box(s, 7.5, 1.55, 2.0, 0.75, 'Grafana\ngrafana.system', { fill: NAVY, color: WHITE, line: NAVY });
  box(s, 7.5, 3.0, 2.0, 0.75, 'vmalert → alertes\n(Slack)', {
    fill: NAVY,
    color: WHITE,
    line: NAVY,
  });
  text(
    s,
    bullets(
      [
        'Chaque application apporte ses propres alertes et tableaux de bord, le socle les collecte.',
        'Rapport des routes Kong généré chaque jour, en lecture seule.',
        "Mesure d'audience mutualisée (Matomo), un site par application.",
      ],
      3,
    ),
    { x: 0.5, y: 4.0, w: 9, h: 1.0, fontSize: 12 },
  );
  s.addNotes(
    'Source : homelab-platform, system/monitoring et system/analytics ; platform-patterns, ServiceMonitor et PrometheusRule rendus par le chart app.\n\n' +
      "Choix de sobriété : VictoriaMetrics plutôt qu'une pile Prometheus complète, environ 300 à 500 Mo pour tout le cluster.",
  );

  // ===== Acte 4 : socle =====
  divider(
    '4. Socle',
    'ACTE 4',
    "Le socle d'infrastructure",
    "homelab-platform : l'infrastructure d'accueil qui rend les patterns réels, sur un cluster volontairement simple.",
  );
  s = content('4. Socle', 'ARCHITECTURE', "Le pattern shared, tel qu'il tourne");
  box(s, 0.5, 2.4, 1.3, 0.8, 'Navigateur', { fill: WHITE, bold: true });
  arrow(s, 1.8, 2.8, 0.45, 0);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 2.25,
    y: 1.45,
    w: 2.0,
    h: 2.7,
    rectRadius: 0.06,
    fill: { color: NAVY },
    line: { type: 'none' },
    objectName: id('edge'),
  });
  text(
    s,
    [
      { text: 'Edge', options: { bold: true, breakLine: true, fontSize: 14 } },
      {
        text: 'ns ingress\ningress-nginx\nTLS · WAF\nune IP publique',
        options: { fontSize: 10.5 },
      },
    ],
    { x: 2.3, y: 1.55, w: 1.9, h: 2.5, color: WHITE, align: 'center', valign: 'middle' },
  );
  arrow(s, 4.25, 1.95, 0.9, 0, ORANGE);
  text(s, '« / »', { x: 4.3, y: 1.62, w: 0.8, h: 0.3, fontSize: 10, color: RUST, align: 'center' });
  box(s, 5.15, 1.55, 1.8, 0.75, 'ui-<app>\ninterface', { fill: PEACH });
  arrow(s, 4.25, 3.35, 0.65, 0, ORANGE);
  text(s, '« /api »', {
    x: 4.25,
    y: 3.02,
    w: 0.75,
    h: 0.3,
    fontSize: 10,
    color: RUST,
    align: 'center',
  });
  box(s, 4.9, 2.95, 1.2, 0.8, 'Kong\nns kong', { fill: WHITE, bold: true });
  arrow(s, 6.1, 3.35, 0.4, 0, ORANGE);
  box(s, 6.5, 2.95, 1.4, 0.8, 'api-<app>\nAPI', { fill: PEACH });
  arrow(s, 7.9, 3.15, 0.4, -0.75);
  arrow(s, 7.9, 3.35, 0.4, 0);
  arrow(s, 7.9, 3.55, 0.4, 0.75);
  box(s, 8.3, 1.95, 1.2, 0.6, 'PostgreSQL\nCNPG', { size: 9.5 });
  box(s, 8.3, 3.05, 1.2, 0.6, 'MinIO', { size: 9.5 });
  box(s, 8.3, 4.15, 1.2, 0.6, 'Redis', { size: 9.5 });
  box(s, 6.5, 4.15, 1.4, 0.6, 'Vault\nsecrets', { size: 9.5, fill: WHITE });
  arrow(s, 7.2, 3.75, 0, 0.4);
  text(s, 'Une base, un seau et un préfixe par application ; identifiants dynamiques par pod.', {
    x: 0.5,
    y: 4.4,
    w: 5.8,
    h: 0.5,
    fontSize: 11.5,
    italic: true,
    color: RUST,
  });
  s.addNotes(
    "Lecture du schéma : l'edge (ingress-nginx, TLS et WAF) sert l'interface directement ; seul /api passe par Kong, qui route vers le namespace api de chaque application.\n\n" +
      "Chaque API n'atteint que les moteurs qu'elle a déclarés (étiquettes de client) et Vault.\n\n" +
      "Règle à ne jamais oublier : ne pas réécrire l'en-tête Host (pas d'upstream-vhost), sinon tous les sites répondent 404.",
  );

  s = content(
    '4. Socle',
    'CE QUE LE SOCLE APPORTE',
    'Livré et maintenu une fois, pour toutes les applications',
  );
  const socle = [
    [
      fa.FaLayerGroup,
      'Socle mutualisé',
      [
        'charts/platform en app-of-apps, version épinglée',
        'Edge, Kong, Vault',
        'PostgreSQL CloudNativePG avec sauvegarde continue',
        'MinIO, Redis',
      ],
    ],
    [
      fa.FaTools,
      'Outillage transverse',
      [
        'SSO Keycloak (sso.crealcs.com)',
        'Argo CD (GitOps)',
        'Supervision VictoriaMetrics et Grafana',
        "Mesure d'audience Matomo",
      ],
    ],
  ];
  for (const [i, [Icon, head, items]] of socle.entries()) {
    const x = 0.5 + i * 4.6;
    card(s, x, 1.45, 4.4, 2.75);
    await badge(s, x + 0.25, 1.65, 0.5, Icon);
    text(s, head, {
      x: x + 0.9,
      y: 1.65,
      w: 3.3,
      h: 0.5,
      fontSize: 15,
      bold: true,
      fontFace: 'Cambria',
      valign: 'middle',
    });
    text(s, bullets(items, 4), { x: x + 0.25, y: 2.35, w: 3.95, h: 1.75, fontSize: 12 });
  }
  text(
    s,
    "Chaque outil a son namespace, son Application Argo CD et ses propres données : aucun cycle de vie n'est accroché à celui d'une application.",
    { x: 0.5, y: 4.35, w: 9, h: 0.6, fontSize: 12.5, italic: true, color: RUST },
  );
  s.addNotes(
    'Source : homelab-platform, platform/README.md et system/README.md.\n\n' +
      "L'outillage transverse a été sorti de l'installation de xpms : quand il y vivait, « SSO ko faute de mise à jour de xpms ». On y revient à l'acte 7.\n\n" +
      "Les sauvegardes PostgreSQL sont assurées par CloudNativePG pour tous ; il revient à chaque application de vérifier qu'une restauration fonctionne.",
  );

  s = content('4. Socle', 'QUI FAIT QUOI', "Personne n'écrit chez l'autre");
  const who = [
    [
      'Admin du socle',
      NAVY,
      [
        'Livre et maintient les outils mutualisés',
        'Émet, une fois par application, les identifiants de provisionnement',
        "Pose l'hôte d'API (une entrée)",
        "Ne touche jamais au namespace d'une application",
      ],
    ],
    [
      'Équipe applicative',
      ORANGE,
      [
        'Porte son Application Argo CD et ses valeurs',
        'Étiquette ses namespaces : déclare les services utilisés',
        'Se provisionne elle-même : sa base, son seau, son préfixe',
        'Pose ses propres routes Kong',
      ],
    ],
  ];
  for (const [i, [head, color, items]] of who.entries()) {
    const x = 0.5 + i * 4.6;
    card(s, x, 1.45, 4.4, 3.45);
    s.addShape(pres.shapes.RECTANGLE, {
      x,
      y: 1.45,
      w: 4.4,
      h: 0.55,
      fill: { color },
      line: { type: 'none' },
      objectName: id('bandeau'),
    });
    text(s, head, {
      x: x + 0.25,
      y: 1.45,
      w: 3.9,
      h: 0.55,
      fontSize: 15,
      bold: true,
      color: WHITE,
      valign: 'middle',
      fontFace: 'Cambria',
    });
    text(s, bullets(items, 6), { x: x + 0.25, y: 2.2, w: 3.95, h: 2.55, fontSize: 12.5 });
  }
  s.addNotes(
    'Source : homelab-platform, CONSUMING.md (« Deux rôles »).\n\n' +
      "C'est ce partage qui rend le partage tenable : un nouvel arrivant ne demande presque rien au socle, et le socle n'a pas à connaître l'application.\n\n" +
      "Ce que l'application doit respecter : sa base avec son rôle, ses seaux, toutes ses clés Redis préfixées, l'en-tête Host préservé, les appels internes par kong-proxy.",
  );

  // ===== Acte 5 : du dépôt à la production =====
  divider(
    '5. Chaîne',
    'ACTE 5',
    'Du dépôt à la production',
    "Un chemin unique et automatisé : la fusion d'une pull request est le seul passage vers le cluster.",
  );
  s = content('5. Chaîne', 'LA CHAÎNE', 'En production une à deux minutes après la fusion');
  const chain = [
    [fa.FaCodeBranch, 'Pull request', "relue, tests et audit d'accessibilité en CI"],
    [fa.FaCheckCircle, 'Fusion', 'seul point de passage'],
    [fa.FaDocker, 'Images', 'construites et poussées sur GHCR'],
    [fa.FaExchangeAlt, 'Promotion', 'commit sur la branche deploy-state'],
    [fa.FaSyncAlt, 'Argo CD', 'synchronise le cluster'],
    [fa.FaGlobe, 'Production', "l'URL répond"],
  ];
  const cw = 9 / 6;
  for (const [i, [Icon, head, sub]] of chain.entries()) {
    const x = 0.5 + i * cw;
    await badge(s, x + cw / 2 - 0.35, 1.6, 0.7, Icon, i === 5 ? GREEN : ORANGE);
    if (i < 5) arrow(s, x + cw / 2 + 0.42, 1.95, cw - 0.84, 0, SLATE);
    text(s, head, {
      x: x + 0.05,
      y: 2.45,
      w: cw - 0.1,
      h: 0.4,
      fontSize: 13,
      bold: true,
      align: 'center',
      fontFace: 'Cambria',
    });
    text(s, sub, {
      x: x + 0.05,
      y: 2.85,
      w: cw - 0.1,
      h: 0.7,
      fontSize: 10.5,
      align: 'center',
      color: SLATE,
    });
  }
  card(s, 0.5, 3.75, 9, 1.15);
  text(
    s,
    bullets(
      [
        "La branche deploy-state contient l'état déployé : chaque mise en production est un commit, donc tracée et réversible.",
        "Argo CD lit deux sources : le chart épinglé en OCI et les valeurs de l'application.",
      ],
      4,
    ),
    { x: 0.75, y: 3.88, w: 8.5, h: 0.95, fontSize: 12 },
  );
  s.addNotes(
    'Exemple réel, ProLearning : 29 mises en production sur deploy-state, chacune une à deux minutes après la fusion de la pull request correspondante.\n\n' +
      "Revenir en arrière = promouvoir l'ancien SHA d'image (workflow de déploiement relancé à la main avec ce SHA).\n\n" +
      "Une promotion prouve la livraison, pas la santé de l'application : la supervision prend le relais.",
  );

  s = content('5. Chaîne', "AUTOMATISER SANS S'ENDETTER", "Le script d'abord, l'IA en exception");
  const agents = [
    [
      'Veille de versions',
      "Renovate ouvre une PR par montée de version épinglée ; un avis IA plafonné dit ce qu'elle change pour le socle.",
    ],
    ['Dérive', "Un script compare ce qui est appliqué à la main (hôtes d'API) avec le cluster."],
    [
      'Dépouillement du WAF',
      "Un script condense les alertes sans données personnelles ; l'IA trie faux positifs et suspects.",
    ],
  ];
  for (const [i, [head, body]] of agents.entries()) {
    const y = 1.45 + i * 0.95;
    card(s, 0.5, y, 5.6, 0.82);
    text(
      s,
      [
        { text: head, options: { bold: true, breakLine: true } },
        { text: body, options: { color: SLATE, fontSize: 11 } },
      ],
      { x: 0.7, y: y + 0.08, w: 5.2, h: 0.7, fontSize: 13 },
    );
  }
  card(s, 6.4, 1.45, 3.1, 2.72, NAVY, NAVY);
  text(
    s,
    [
      {
        text: "Garde-fous de l'IA",
        options: { bold: true, breakLine: true, fontSize: 14, color: ORANGE },
      },
      {
        text: 'Modèle économique, jamais le plus gros',
        options: { bullet: true, breakLine: true },
      },
      { text: 'Nombre de tours plafonné', options: { bullet: true, breakLine: true } },
      {
        text: 'Lecture seule, un commentaire en sortie',
        options: { bullet: true, breakLine: true },
      },
      { text: 'Entrée bornée, jamais des logs bruts', options: { bullet: true, breakLine: true } },
      { text: 'Une fois par événement', options: { bullet: true } },
    ],
    { x: 6.6, y: 1.6, w: 2.75, h: 2.45, fontSize: 11.5, color: WHITE, paraSpaceAfter: 4 },
  );
  text(s, "La fusion d'une PR reste le seul point de passage vers le cluster.", {
    x: 0.5,
    y: 4.4,
    w: 9,
    h: 0.45,
    fontSize: 12.5,
    italic: true,
    color: RUST,
  });
  s.addNotes(
    'Source : homelab-platform, AGENTS.md.\n\n' +
      "Ce qui se décide mécaniquement est un script, gratuit et reproductible. L'IA n'intervient que là où il faut lire et juger, et toujours sous plafond.\n\n" +
      'Pas encore en place : un premier diagnostic automatique sur alerte, qui demanderait un accès en lecture au cluster. À poser seulement quand le bruit des alertes est connu.',
  );

  // ===== Acte 6 : pilotes =====
  divider(
    '6. Pilotes',
    'ACTE 6',
    'Deux patterns, deux pilotes',
    "Chaque pattern a été éprouvé par une vraie application avant d'être proposé aux suivantes.",
  );
  s = content('6. Pilotes', 'LES PILOTES', 'Éprouver les patterns, pas seulement déployer');
  const pilots = [
    [
      'xpms',
      'pilote dedicated',
      NAVY,
      [
        'Gestion locative, application complète',
        'Ses propres PostgreSQL CNPG, Redis et MinIO, dans sa release',
        'Reste en dedicated, par choix',
      ],
      "Leçon : l'outillage (SSO, Argo CD, supervision) vivait dans son installation, d'où « SSO ko faute de mise à jour de xpms ». Il a été sorti dans homelab-platform.",
    ],
    [
      'TreasureHunters',
      'pilote shared',
      ORANGE,
      [
        'Première application sur le socle mutualisé',
        'Son deploy/ sert de modèle aux suivantes',
        'Ses écarts avec le chart ont nourri le réalignement',
      ],
      'Leçon : un écart constaté (Ingress et provisionnement posés à la main) doit remonter aux patterns, pas rester une exception locale.',
    ],
  ];
  for (const [i, [name, sub, color, items, lesson]] of pilots.entries()) {
    const x = 0.5 + i * 4.6;
    card(s, x, 1.45, 4.4, 3.45);
    s.addShape(pres.shapes.RECTANGLE, {
      x,
      y: 1.45,
      w: 4.4,
      h: 0.6,
      fill: { color },
      line: { type: 'none' },
      objectName: id('bandeau'),
    });
    text(
      s,
      [
        { text: name, options: { bold: true } },
        { text: `  ·  ${sub}`, options: { italic: true } },
      ],
      {
        x: x + 0.25,
        y: 1.45,
        w: 3.9,
        h: 0.6,
        fontSize: 15,
        color: WHITE,
        valign: 'middle',
        fontFace: 'Cambria',
      },
    );
    text(s, bullets(items, 3), { x: x + 0.25, y: 2.2, w: 3.95, h: 1.1, fontSize: 12 });
    text(s, lesson, {
      x: x + 0.25,
      y: 3.4,
      w: 3.95,
      h: 1.4,
      fontSize: 11,
      italic: true,
      color: RUST,
    });
  }
  s.addNotes(
    "Une pilote ne sert pas qu'à être déployée : elle sert à trouver ce que les patterns ne disent pas encore.\n\n" +
      "Les deux leçons ont donné des principes du socle : l'outillage a son propre cycle de vie, et un écart constaté remonte aux patterns au lieu de rester une exception locale.",
  );

  // ===== Acte 7 : reproduction =====
  divider(
    '7. Reproduction',
    'ACTE 7',
    'La preuve par la reproduction',
    'Une fois les pilotes passées, les applications suivantes arrivent à un rythme régulier, sur le même chemin.',
  );
  s = content('7. Reproduction', 'LES ARRIVÉES', 'Une nouvelle application presque chaque semaine');
  const arrivals = [
    ['17 sept.', 'platform-patterns', 'premier commit'],
    ['22 sept.', 'homelab-platform', 'socle mutualisé'],
    ['24 sept.', 'TreasureHunters', 'pilote shared'],
    ['30 sept.', 'mtgwars', ''],
    ['6 oct.', 'wh4chars', 'base, seau et API'],
    ['12 oct.', 'ProLearning', '3 bases'],
    ['nov.', 'ludi-tabulares', ''],
  ];
  const aw = 9 / arrivals.length;
  s.addShape(pres.shapes.LINE, {
    x: 0.5,
    y: 2.5,
    w: 9,
    h: 0,
    line: { color: SLATE, width: 1.5 },
    objectName: id('axe'),
  });
  for (const [i, [date, name, sub]] of arrivals.entries()) {
    const cx = 0.5 + aw * i + aw / 2;
    const app = i >= 2;
    s.addShape(pres.shapes.OVAL, {
      x: cx - 0.13,
      y: 2.37,
      w: 0.26,
      h: 0.26,
      fill: { color: app ? ORANGE : NAVY },
      line: { type: 'none' },
      objectName: id('jalon'),
    });
    text(s, date, {
      x: cx - aw / 2,
      y: 1.85,
      w: aw,
      h: 0.35,
      fontSize: 11,
      bold: true,
      align: 'center',
      color: RUST,
    });
    text(s, name, {
      x: cx - aw / 2 + 0.02,
      y: 2.8,
      w: aw - 0.04,
      h: 0.45,
      fontSize: 11,
      bold: true,
      align: 'center',
      fontFace: 'Cambria',
    });
    text(s, sub, {
      x: cx - aw / 2 + 0.02,
      y: 3.25,
      w: aw - 0.04,
      h: 0.45,
      fontSize: 9.5,
      align: 'center',
      color: SLATE,
    });
  }
  card(s, 0.5, 3.95, 9, 0.95);
  text(
    s,
    "Pour chaque application, le socle n'a eu qu'une poignée de gestes : une base (et un seau si besoin), un hôte d'API. xpms, en dedicated, et findout complètent les 7 applications hébergées.",
    { x: 0.75, y: 4.02, w: 8.5, h: 0.8, fontSize: 12, valign: 'middle' },
  );
  s.addNotes(
    'Dates tirées des historiques Git de platform-patterns et de homelab-platform (première trace de chaque application côté socle).\n\n' +
      'Le rythme parle de lui-même : après la pilote, une application tous les six à sept jours, chacune sur le même chemin.',
  );

  // ProLearning sur deux pistes
  s = content(
    '7. Reproduction',
    'PROLEARNING, HEURE PAR HEURE',
    'Du premier commit à la production en 18 heures',
  );
  const lanes = [
    ['Application', 1.55, ORANGE],
    ['Socle', 3.75, NAVY],
  ];
  for (const [label, y, color] of lanes) {
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5,
      y,
      w: 1.15,
      h: 0.95,
      fill: { color },
      line: { type: 'none' },
      objectName: id('piste'),
    });
    text(s, label, {
      x: 0.5,
      y,
      w: 1.15,
      h: 0.95,
      fontSize: 12,
      bold: true,
      color: WHITE,
      align: 'center',
      valign: 'middle',
    });
  }
  s.addShape(pres.shapes.LINE, {
    x: 1.75,
    y: 3.1,
    w: 7.75,
    h: 0,
    line: { color: SLATE, width: 1.5, endArrowType: 'triangle' },
    objectName: id('temps'),
  });
  const ticks = [
    ['J1 soir', 1.9],
    ['J2 7 h 30', 3.4],
    ['J2 13 h 40', 5.0],
    ['J2 après-midi', 6.45],
    ['J3 matin', 8.3],
  ];
  for (const [label, x] of ticks) {
    s.addShape(pres.shapes.LINE, {
      x,
      y: 3.0,
      w: 0,
      h: 0.2,
      line: { color: SLATE, width: 1 },
      objectName: id('graduation'),
    });
    text(s, label, {
      x: x - 0.6,
      y: 3.2,
      w: 1.2,
      h: 0.3,
      fontSize: 9.5,
      align: 'center',
      color: SLATE,
    });
  }
  const appEvents = [
    [1.75, 'Décisions, squelette, Keycloak, rôles'],
    [3.25, 'PR « déploiement sur le socle »'],
    [4.85, '1re mise en production', true],
    [6.3, 'Étapes 2 à 5 : 4 mises en production en 1 h'],
    [8.0, 'Pilote complet en production'],
  ];
  for (const [x, label, strong] of appEvents) {
    box(s, x, 1.55, 1.35, 0.95, label, {
      size: 9.5,
      fill: strong ? GREEN : WHITE,
      color: strong ? WHITE : NAVY,
      line: strong ? GREEN : LINE,
      bold: !!strong,
    });
    s.addShape(pres.shapes.LINE, {
      x: x + 0.67,
      y: 2.5,
      w: 0,
      h: 0.6,
      line: { color: LINE, width: 1, dashType: 'dash' },
      objectName: id('repere'),
    });
  }
  const socleEvents = [
    [3.25, 'Demandes de 2 bases, même minute'],
    [6.6, '3e base (évaluation) le soir'],
  ];
  for (const [x, label] of socleEvents) {
    box(s, x, 3.75, 1.5, 0.95, label, { size: 9.5 });
    s.addShape(pres.shapes.LINE, {
      x: x + 0.75,
      y: 3.1,
      w: 0,
      h: 0.65,
      line: { color: LINE, width: 1, dashType: 'dash' },
      objectName: id('repere'),
    });
  }
  s.addNotes(
    "Reconstitué à partir de l'historique Git de ProLearning, de sa branche deploy-state et de l'historique de homelab-platform (heures approximatives, fuseaux mêlés dans Git).\n\n" +
      'J1, samedi 11 octobre, soirée : décisions de démarrage consignées, squelette complet (front, API, CI), connexion Keycloak, rôles, bascule production/démo.\n' +
      'J2, 7 h 37 UTC : PR « Déploiement sur homelab-platform (pattern shared) », workflows repris de TreasureHunters ; la même minute, demandes des deux premières bases au socle.\n' +
      'J2, 13 h 39 UTC : première promotion sur deploy-state.\n' +
      'J2 après-midi : import des formations, lecteur, catalogue, demandes, chacun en production une à deux minutes après sa fusion. Soir : troisième base demandée et obtenue.\n' +
      "J3 matin : refonte de l'interface, accessibilité, données personnelles ; le pilote complet est en production environ 36 h après le premier commit.\n\n" +
      "Dire que le développement était assisté par Claude Code : temps calendaire, pas effort d'équipe.",
  );

  s = content('7. Reproduction', 'LES CHIFFRES', 'ProLearning, en résumé');
  const figures = [
    ['18 h', 'premier commit → première mise en production'],
    ['36 h', 'premier commit → pilote complet en production'],
    ['29', 'mises en production, toutes par le même chemin'],
    ['1 à 2 min', "entre la fusion d'une PR et sa promotion"],
    ['4', "gestes côté socle : 3 bases et 1 hôte d'API"],
    ['1 PR', 'pour migrer au pattern réaligné (« 4e cobaye »)'],
  ];
  for (const [i, [big, small]] of figures.entries()) {
    const col = i % 3,
      row = Math.floor(i / 3);
    const x = 0.5 + col * 3.05,
      y = 1.45 + row * 1.75;
    card(
      s,
      x,
      y,
      2.85,
      1.6,
      row === 0 && col === 0 ? NAVY : WHITE,
      row === 0 && col === 0 ? NAVY : LINE,
    );
    text(s, big, {
      x: x + 0.2,
      y: y + 0.15,
      w: 2.5,
      h: 0.7,
      fontSize: 30,
      bold: true,
      fontFace: 'Cambria',
      color: ORANGE,
    });
    text(s, small, {
      x: x + 0.2,
      y: y + 0.9,
      w: 2.5,
      h: 0.6,
      fontSize: 11.5,
      color: row === 0 && col === 0 ? WHITE : SLATE,
    });
  }
  s.addNotes(
    '25 pull requests fusionnées entre le 11 octobre et le 26 novembre, 29 promotions sur deploy-state.\n\n' +
      "Les gestes côté socle au démarrage : bases prolearning et prolearning-demo par le guichet, puis prolearning-eval le soir même, et l'entrée de l'hôte d'API. Depuis le réalignement, les applications se provisionnent elles-mêmes.\n\n" +
      "Précaution : une promotion prouve la livraison, pas la santé de l'application.",
  );

  s = content(
    '7. Reproduction',
    'POUR UNE NOUVELLE APPLICATION',
    "Ce qu'elle apporte, et tout ce qu'elle n'a pas à faire",
  );
  const bring = [
    [
      "Ce qu'elle apporte",
      ORANGE,
      [
        'Ses images (front, API) sur les standards',
        'Un fichier de valeurs du chart app',
        'Une Application Argo CD pointant une version épinglée',
        'Ses secrets, créés hors Git',
        'Ses routes, ses alertes, ses tableaux de bord',
      ],
    ],
    [
      "Ce qu'elle n'a pas à faire",
      GREEN,
      [
        'TLS, certificats, pare-feu applicatif',
        'Gateway API et routage',
        'Sauvegardes PostgreSQL (mais vérifier une restauration)',
        "Supervision de base, SSO, mesure d'audience",
        'Isolation réseau et durcissement des conteneurs',
      ],
    ],
  ];
  for (const [i, [head, color, items]] of bring.entries()) {
    const x = 0.5 + i * 4.6;
    card(s, x, 1.45, 4.4, 3.45);
    s.addShape(pres.shapes.RECTANGLE, {
      x,
      y: 1.45,
      w: 4.4,
      h: 0.55,
      fill: { color },
      line: { type: 'none' },
      objectName: id('bandeau'),
    });
    text(s, head, {
      x: x + 0.25,
      y: 1.45,
      w: 3.9,
      h: 0.55,
      fontSize: 15,
      bold: true,
      color: WHITE,
      valign: 'middle',
      fontFace: 'Cambria',
    });
    text(s, bullets(items, 6), { x: x + 0.25, y: 2.2, w: 3.95, h: 2.6, fontSize: 12.5 });
  }
  s.addNotes(
    "C'est la diapositive qui explique la semaine : la colonne de droite est tout le travail qu'une équipe n'a plus à faire, parce qu'il est dans le pattern et dans le socle.\n\n" +
      "Pour une démonstration en direct : suivre l'arrivée d'une application fictive, d'un dépôt vide jusqu'à l'URL qui répond, en montrant la PR, la CI, la promotion et la synchronisation Argo CD.",
  );

  // ===== Acte 8 : une démarche qui se corrige =====
  divider(
    '8. Boucle',
    'ACTE 8',
    'Une démarche qui se corrige elle-même',
    'La reproduction révèle les écarts ; les patterns se réalignent ; le socle suit ; les applications migrent sans casser.',
  );
  s = content('8. Boucle', 'LA BOUCLE', 'Les écarts deviennent des décisions, puis des versions');
  const loop = [
    ['Implémentation', 'le socle grandit avec des charts maison et une liste de locataires'],
    ['Écart', "la reproduction montre qu'il a divergé du modèle"],
    ['Décision', 'ADR 0001 (20 octobre) : le modèle shared est réaligné'],
    ['Réalignement', 'le socle adopte charts/platform, CNPG et Vault (phases 1 à 5)'],
    ['Migration', 'chaque application bascule en une PR, sans changer son code'],
  ];
  const lc = [
    [1.0, 1.45],
    [5.6, 1.45],
    [7.0, 2.9],
    [4.3, 3.85],
    [0.6, 2.9],
  ];
  for (const [i, [head, body]] of loop.entries()) {
    const [x, y] = lc[i];
    card(s, x, y, 2.4, 1.05, i === 2 ? NAVY : WHITE, i === 2 ? NAVY : LINE);
    text(
      s,
      [
        {
          text: `${i + 1}. ${head}`,
          options: { bold: true, breakLine: true, color: i === 2 ? ORANGE : RUST },
        },
        { text: body, options: { fontSize: 10, color: i === 2 ? WHITE : SLATE } },
      ],
      { x: x + 0.15, y: y + 0.08, w: 2.1, h: 0.9, fontSize: 12.5 },
    );
  }
  arrow(s, 3.4, 1.95, 2.2, 0, ORANGE);
  arrow(s, 7.9, 2.5, 0.2, 0.4, ORANGE);
  arrow(s, 7.0, 3.6, -0.3, 0.6, ORANGE);
  arrow(s, 4.3, 4.35, -1.3, -0.4, ORANGE);
  arrow(s, 1.8, 2.9, 0.2, -0.4, ORANGE);
  text(s, "La reproduction n'est pas seulement la preuve : c'est le moteur de l'amélioration.", {
    x: 3.55,
    y: 2.75,
    w: 3.15,
    h: 0.9,
    fontSize: 13,
    italic: true,
    color: NAVY,
    align: 'center',
    valign: 'middle',
    fontFace: 'Cambria',
  });
  s.addNotes(
    'Source : homelab-platform, docs/alignement-patterns-1.0.0.md ; platform-patterns, ADR 0001.\n\n' +
      "Le socle avait divergé : charts maison, provisionnement piloté par une liste de locataires, secrets statiques. Les patterns 1.0.0 ont fixé le modèle ; le socle l'a adopté par phases ; les applications ont suivi une à une (ProLearning le 23 octobre, en une PR, « 4e cobaye »).\n\n" +
      'Message à faire passer : investir dans les patterns paie à chaque nouvelle application, y compris quand on se trompe.',
  );

  s = content('8. Boucle', "RETOURS D'EXPÉRIENCE", 'Ce que le terrain a appris aux patterns');
  const lessons = [
    [
      'Une seule IP publique',
      "Deux frontaux ne peuvent pas tenir 80/443 en même temps : la bascule de l'edge se fait en une fois, en retirant l'ancien avant.",
    ],
    [
      'Résolution interne',
      'Oublier de repointer CoreDNS sur le nouvel edge rend *.crealcs.com introuvable en interne : les certificats restent bloqués.',
    ],
    [
      "L'en-tête Host",
      "Le réécrire fait répondre 404 à tous les sites : c'est un invariant documenté du socle.",
    ],
    [
      'Argo CD et CRD',
      'Ignorer le .status dans le calcul des différences ; purger les annotations trop longues des CRD CloudNativePG.',
    ],
  ];
  for (const [i, [head, body]] of lessons.entries()) {
    const col = i % 2,
      row = Math.floor(i / 2);
    const x = 0.5 + col * 4.6,
      y = 1.45 + row * 1.75;
    card(s, x, y, 4.4, 1.6);
    await badge(s, x + 0.2, y + 0.2, 0.45, fa.FaExclamationTriangle, RUST);
    text(s, head, {
      x: x + 0.8,
      y: y + 0.2,
      w: 3.4,
      h: 0.45,
      fontSize: 14,
      bold: true,
      fontFace: 'Cambria',
      valign: 'middle',
    });
    text(s, body, { x: x + 0.2, y: y + 0.75, w: 4.0, h: 0.8, fontSize: 11, color: SLATE });
  }
  s.addNotes(
    "Ces pièges sont documentés dans les runbooks de homelab-platform (platform/README.md, edge/README.md) : c'est leur place, pour que la prochaine bascule ne les retrouve pas.\n\n" +
      "Pour un public d'opérateurs, chacun peut devenir un cas pratique : symptôme, diagnostic, correction.",
  );

  s = content('8. Boucle', 'CE QUI RESTE À FAIRE', 'Une démarche vivante');
  const todo = [
    [
      fa.FaUndo,
      'Épreuve de restauration',
      "La sauvegarde est assurée par CloudNativePG ; l'épreuve de restauration côté socle mutualisé reste à réoutiller.",
    ],
    [
      fa.FaStethoscope,
      "Diagnostic d'alerte",
      'Un premier diagnostic automatique sur alerte, à poser quand le bruit des alertes sera connu.',
    ],
    [
      fa.FaBook,
      'Documentation de phase 5',
      'Réécrire les guides de déploiement et de consommation autour de charts/platform et charts/app.',
    ],
  ];
  for (const [i, [Icon, head, body]] of todo.entries()) {
    const x = 0.5 + i * 3.05;
    card(s, x, 1.45, 2.85, 3.45);
    await badge(s, x + 0.25, 1.7, 0.55, Icon, SLATE);
    text(s, head, {
      x: x + 0.25,
      y: 2.4,
      w: 2.4,
      h: 0.65,
      fontSize: 15,
      bold: true,
      fontFace: 'Cambria',
    });
    text(s, body, { x: x + 0.25, y: 3.05, w: 2.4, h: 1.75, fontSize: 12, color: SLATE });
  }
  s.addNotes(
    'Présenter ces chantiers comme tels : ils sont connus, documentés, et suivent la même démarche. Les cacher affaiblirait la crédibilité du reste.',
  );

  // ===== Conclusion =====
  pres.addSection({ title: 'Conclusion' });
  s = pres.addSlide({ masterName: 'Section', sectionTitle: 'Conclusion' });
  s.addText('EN RÉSUMÉ', { placeholder: 'eyebrow' });
  s.addText("Ce qu'il faut retenir", { placeholder: 'title' });
  s.addText(
    [
      {
        text: "Standardiser ce qu'on maîtrise : la sécurité et la supervision viennent avec le pattern.",
        options: { bullet: true, breakLine: true },
      },
      {
        text: "Séparer définition, implémentation et consommation : App → Pattern, jamais l'inverse.",
        options: { bullet: true, breakLine: true },
      },
      {
        text: 'Prouver par la reproduction : une petite application en production en une semaine.',
        options: { bullet: true },
      },
    ],
    { placeholder: 'body', paraSpaceAfter: 8 },
  );
  await badge(s, 8.6, 1.45, 0.75, fa.FaRocket);
  s.addNotes(
    'Revenir à la promesse du début et la relier aux trois exigences de départ : simplicité, sécurité, standardisation.\n\n' +
      'Pistes pour la suite de la discussion : quelle application candidate pour la prochaine arrivée ? Quel pattern ? Qui côté équipe applicative, qui côté socle ?',
  );

  await pres.writeFile({ fileName: output });
  await applyTheme(output, THEME);
  console.log('écrit :', output);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
