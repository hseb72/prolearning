// Présentations PowerPoint des parcours en ligne, générées depuis les fichiers de formation.
// Usage : node generer-presentation.js <formation.json> <sortie.pptx> [titre du parcours suivant]
const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');
const fa = require('react-icons/fa');
const JSZip = require('jszip');

const [, , input, output, nextTitle] = process.argv;
const f = JSON.parse(fs.readFileSync(input, 'utf8'));

const HEX = {
  navy: '14213D',
  orange: 'E07A2E',
  accent: 'AA5118',
  paper: 'F7F5F0',
  white: 'FFFFFF',
  green: '2E7958',
  slate: '5B6478',
  line: 'E4DFD3',
};
const THEME = {
  name: '3S - Pro Learning',
  headFontFace: 'Cambria',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: HEX.navy,
    lt1: HEX.white,
    dk2: '24345C',
    lt2: HEX.paper,
    accent1: HEX.orange,
    accent2: HEX.accent,
    accent3: HEX.green,
    accent4: HEX.slate,
    accent5: HEX.line,
    accent6: 'F3D9C4',
    hlink: HEX.accent,
    folHlink: '7A3A10',
  },
};

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9'; // 10 × 5,625 pouces
pres.title = f.titre;
pres.subject = f.sousTitre;
pres.author = '3S - Pro Learning';
pres.company = '3S - Pro Learning';
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
// Couleurs de thème : texte foncé, fond papier, orange, orange foncé, vert, ardoise, filet, pêche.
const NAVY = C.text1,
  WHITE = C.background1,
  PAPER = C.background2,
  ORANGE = C.accent1,
  RUST = C.accent2,
  GREEN = C.accent3,
  SLATE = C.accent4,
  LINE = C.accent5,
  PEACH = C.accent6;

// pptxgenjs n'écrit pas les couleurs du thème : on remplace le jeu de couleurs après coup.
async function applyTheme(file, theme) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
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
  fs.writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}

// ---------- Icônes ----------
async function icon(Component, hex, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Component, { color: '#' + hex, size: String(size) }),
  );
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + png.toString('base64');
}

const TYPES = {
  lecon: { label: 'Leçons', one: 'leçon', many: 'leçons', icon: fa.FaBookOpen },
  diaporama: { label: 'Diaporamas', one: 'diaporama', many: 'diaporamas', icon: fa.FaImages },
  ordre: {
    label: 'Exercices',
    one: 'remise en ordre',
    many: 'remises en ordre',
    icon: fa.FaSortAmountDown,
  },
  association: {
    label: 'Exercices',
    one: 'association',
    many: 'associations',
    icon: fa.FaProjectDiagram,
  },
  scenario: {
    label: 'Mise en situation',
    one: 'mise en situation',
    many: 'mises en situation',
    icon: fa.FaComments,
  },
  pratique: {
    label: 'Travaux pratiques',
    one: 'TP guidé',
    many: 'TP guidés',
    icon: fa.FaLaptopCode,
  },
  fiches: { label: 'Fiches', one: 'jeu de fiches', many: 'jeux de fiches', icon: fa.FaLayerGroup },
  quiz: { label: 'Quiz', one: 'quiz', many: 'quiz', icon: fa.FaClipboardCheck },
};

const minutes = (m) =>
  m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
const level =
  { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' }[f.niveau] ?? f.niveau;
const count = (acts, type) => acts.filter((a) => a.type === type).length;
const allActs = f.modules.flatMap((m) => m.activites);

// ---------- Mises en page ----------
const FOOTER = `3S - Pro Learning · ${f.titre}`;
const footer = (dark) => [
  {
    text: {
      text: FOOTER,
      options: {
        x: 0.5,
        y: 5.22,
        w: 7.5,
        h: 0.25,
        fontSize: 9,
        color: dark ? PEACH : SLATE,
        margin: 0,
      },
    },
  },
];

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
          y: 1.0,
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
          y: 1.4,
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
          h: 0.5,
          fontSize: 18,
          color: PEACH,
          italic: true,
          margin: 0,
        },
        text: '',
      },
    },
    {
      text: {
        text: '3S - Pro Learning',
        options: {
          x: 0.6,
          y: 5.1,
          w: 5,
          h: 0.35,
          fontSize: 12,
          bold: true,
          color: WHITE,
          margin: 0,
        },
      },
    },
  ],
});

pres.defineSlideMaster({
  title: 'Contenu',
  background: { color: PAPER },
  margin: [0.4, 0.5, 0.5, 0.5],
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
          fontSize: 26,
          color: NAVY,
          valign: 'top',
          margin: 0,
        },
        text: '',
      },
    },
    { line: { x: 0.5, y: 5.12, w: 9, h: 0, line: { color: LINE, width: 0.75 } } },
    ...footer(false),
  ],
  slideNumber: { x: 9.0, y: 5.2, w: 0.5, h: 0.28, fontSize: 9, color: SLATE, align: 'right' },
});

pres.defineSlideMaster({
  title: 'Fin',
  background: { color: NAVY },
  objects: [
    {
      placeholder: {
        options: {
          name: 'title',
          type: 'title',
          align: 'left',
          x: 0.6,
          y: 1.2,
          w: 8.8,
          h: 1.0,
          fontSize: 34,
          color: WHITE,
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
          y: 2.3,
          w: 8.8,
          h: 1.8,
          fontSize: 16,
          color: PEACH,
          valign: 'top',
          margin: 0,
        },
        text: '',
      },
    },
    ...footer(true),
  ],
});

// ---------- Briques ----------
let shapeId = 0;
const name = (n) => `${n}-${++shapeId}`;

function card(slide, x, y, w, h, fill = WHITE) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: LINE, width: 0.75 },
    objectName: name('carte'),
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
    objectName: name('pastille'),
  });
  const pad = d * 0.24;
  slide.addImage({
    data: await icon(Icon, 'FFFFFF'),
    x: x + pad,
    y: y + pad,
    w: d - 2 * pad,
    h: d - 2 * pad,
    objectName: name('icone'),
    altText: '',
  });
}

function text(slide, value, opts) {
  slide.addText(value, {
    isTextBox: true,
    margin: 0,
    color: NAVY,
    fontSize: 12,
    valign: 'top',
    objectName: name('texte'),
    ...opts,
  });
}

function bullets(items, opts = {}) {
  return items.map((t, i) => ({
    text: t,
    options: {
      bullet: { indent: 12 },
      paraSpaceAfter: opts.space ?? 5,
      breakLine: i < items.length - 1,
    },
  }));
}

// ---------- Diapositives ----------
async function build() {
  // 1. Titre
  pres.addSection({ title: 'Introduction' });
  let s = pres.addSlide({ masterName: 'Titre', sectionTitle: 'Introduction' });
  s.addText(`PARCOURS EN LIGNE · ${f.theme.toUpperCase()}`, { placeholder: 'eyebrow' });
  s.addText(f.titre, { placeholder: 'title' });
  s.addText(f.sousTitre, { placeholder: 'subtitle' });
  const facts = [
    [fa.FaSignal, level],
    [fa.FaClock, minutes(f.dureeEstimeeMinutes)],
    [fa.FaCubes, `${f.modules.length} modules`],
    [fa.FaTasks, `${allActs.length} activités`],
  ];
  for (const [i, [Icon, label]] of facts.entries()) {
    const x = 0.6 + i * 2.2;
    await badge(s, x, 3.85, 0.42, Icon);
    text(s, label, {
      x: x + 0.52,
      y: 3.85,
      w: 1.6,
      h: 0.42,
      fontSize: 13,
      color: WHITE,
      valign: 'middle',
    });
  }
  s.addNotes(
    `Présentation du parcours « ${f.titre} ». ${f.resume}\n\n` +
      `Niveau ${level.toLowerCase()}, environ ${minutes(f.dureeEstimeeMinutes)} de travail en autonomie, ${f.modules.length} modules et ${allActs.length} activités. ` +
      `Le parcours se suit sur la plateforme 3S - Pro Learning, onglet « Mon parcours en ligne », sans validation manager.`,
  );

  // 2. Public et prérequis
  s = pres.addSlide({ masterName: 'Contenu', sectionTitle: 'Introduction' });
  s.addText("À QUI S'ADRESSE CE PARCOURS", { placeholder: 'eyebrow' });
  s.addText('Public, prérequis et format', { placeholder: 'title' });
  const cols = [
    [fa.FaUsers, 'Public', f.public],
    [fa.FaCheckCircle, 'Prérequis', f.prerequis],
  ];
  for (const [i, [Icon, head, body]] of cols.entries()) {
    const x = 0.5 + i * 3.05;
    card(s, x, 1.45, 2.85, 3.45);
    await badge(s, x + 0.25, 1.65, 0.5, Icon);
    text(s, head, {
      x: x + 0.25,
      y: 2.27,
      w: 2.4,
      h: 0.35,
      fontSize: 15,
      bold: true,
      fontFace: 'Cambria',
    });
    text(s, body, {
      x: x + 0.25,
      y: 2.65,
      w: 2.4,
      h: 2.15,
      fontSize: 11.5,
      color: SLATE,
      lineSpacingMultiple: 1.1,
    });
  }
  // Chiffres clés
  card(s, 6.6, 1.45, 2.9, 3.45, NAVY);
  const stats = [
    [minutes(f.dureeEstimeeMinutes), 'de travail en autonomie'],
    [String(f.modules.length), "modules à suivre dans l'ordre"],
    [String(count(allActs, 'pratique')), 'travaux pratiques guidés'],
  ];
  for (const [i, [big, small]] of stats.entries()) {
    const y = 1.6 + i * 1.08;
    text(s, big, {
      x: 6.85,
      y,
      w: 2.5,
      h: 0.6,
      fontSize: 32,
      bold: true,
      color: ORANGE,
      fontFace: 'Cambria',
    });
    text(s, small, { x: 6.85, y: y + 0.6, w: 2.5, h: 0.3, fontSize: 11, color: WHITE });
  }
  s.addNotes(
    `Public visé : ${f.public}.\n\nPrérequis : ${f.prerequis}\n\n` +
      `Les modules se débloquent l'un après l'autre : il faut terminer les activités obligatoires et réussir le quiz d'un module pour ouvrir le suivant.`,
  );

  // 3. Objectifs
  s = pres.addSlide({ masterName: 'Contenu', sectionTitle: 'Introduction' });
  s.addText('OBJECTIFS PÉDAGOGIQUES', { placeholder: 'eyebrow' });
  s.addText('À la fin du parcours, vous saurez…', { placeholder: 'title' });
  const objs = f.objectifs;
  const perCol = Math.ceil(objs.length / 2);
  const rowH = Math.min(0.86, 3.6 / perCol);
  objs.forEach((o, i) => {
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    const x = 0.5 + col * 4.6;
    const y = 1.45 + row * rowH;
    s.addShape(pres.shapes.OVAL, {
      x,
      y: y + 0.02,
      w: 0.36,
      h: 0.36,
      fill: { color: i % 2 ? NAVY : ORANGE },
      line: { type: 'none' },
      objectName: name('numero'),
    });
    text(s, String(i + 1), {
      x,
      y: y + 0.02,
      w: 0.36,
      h: 0.36,
      fontSize: 12,
      bold: true,
      color: WHITE,
      align: 'center',
      valign: 'middle',
    });
    text(
      s,
      o.replace(/^Savoir /, '').replace(/^./, (c) => c.toUpperCase()),
      {
        x: x + 0.5,
        y,
        w: 3.9,
        h: rowH - 0.05,
        fontSize: objs.length > 8 ? 10.5 : 11.5,
        color: NAVY,
      },
    );
  });
  s.addNotes('Objectifs du parcours :\n' + objs.map((o, i) => `${i + 1}. ${o}`).join('\n'));

  // 4. Le parcours en un coup d'œil
  s = pres.addSlide({ masterName: 'Contenu', sectionTitle: 'Introduction' });
  s.addText("LE PARCOURS EN UN COUP D'ŒIL", { placeholder: 'eyebrow' });
  s.addText(`${f.modules.length} modules, ${minutes(f.dureeEstimeeMinutes)}`, {
    placeholder: 'title',
  });
  const n = f.modules.length;
  const step = 9 / n;
  s.addShape(pres.shapes.LINE, {
    x: 0.5 + step / 2,
    y: 1.85,
    w: step * (n - 1),
    h: 0,
    line: { color: ORANGE, width: 2 },
    objectName: name('frise'),
  });
  f.modules.forEach((m, i) => {
    const cx = 0.5 + step * i + step / 2;
    s.addShape(pres.shapes.OVAL, {
      x: cx - 0.32,
      y: 1.53,
      w: 0.64,
      h: 0.64,
      fill: { color: NAVY },
      line: { color: ORANGE, width: 2 },
      objectName: name('etape'),
    });
    text(s, String(i + 1), {
      x: cx - 0.32,
      y: 1.53,
      w: 0.64,
      h: 0.64,
      fontSize: 18,
      bold: true,
      color: WHITE,
      align: 'center',
      valign: 'middle',
      fontFace: 'Cambria',
    });
    card(s, 0.5 + step * i + 0.08, 2.45, step - 0.16, 2.45);
    text(s, m.titre, {
      x: 0.5 + step * i + 0.22,
      y: 2.6,
      w: step - 0.44,
      h: 1.35,
      fontSize: n > 4 ? 12 : 13,
      bold: true,
      fontFace: 'Cambria',
    });
    const acts = m.activites;
    text(
      s,
      [
        {
          text: `${m.dureeEstimeeMinutes} min`,
          options: { bold: true, color: RUST, breakLine: true },
        },
        { text: `${acts.length} activités, dont ${count(acts, 'lecon')} leçons et 1 TP` },
      ],
      { x: 0.5 + step * i + 0.22, y: 4.0, w: step - 0.44, h: 0.8, fontSize: 10.5, color: SLATE },
    );
  });
  s.addNotes(
    f.modules
      .map((m, i) => `Module ${i + 1} — ${m.titre} (${m.dureeEstimeeMinutes} min) : ${m.resume}`)
      .join('\n\n'),
  );

  // 5. Un module = toujours la même progression
  s = pres.addSlide({ masterName: 'Contenu', sectionTitle: 'Introduction' });
  s.addText('COMMENT ON APPREND', { placeholder: 'eyebrow' });
  s.addText('Chaque module suit la même progression', { placeholder: 'title' });
  const scenarioName = f.modules
    .map((m) => m.activites.find((a) => a.type === 'scenario'))
    .filter(Boolean);
  const steps = [
    [
      fa.FaBookOpen,
      'Comprendre',
      `${count(allActs, 'lecon')} leçons courtes, avec des encadrés « Approfondir » et des références.`,
    ],
    [
      fa.FaProjectDiagram,
      "S'exercer",
      `${count(allActs, 'ordre') + count(allActs, 'association')} exercices de remise en ordre et d'association.`,
    ],
    [
      fa.FaComments,
      'Décider',
      `${scenarioName.length} mises en situation chez Atelia : chaque choix a ses conséquences.`,
    ],
    [
      fa.FaLaptopCode,
      'Pratiquer',
      `${count(allActs, 'pratique')} TP guidés : fichiers, étapes, résultats attendus, auto-vérification.`,
    ],
    [
      fa.FaLayerGroup,
      'Réviser',
      `${count(allActs, 'fiches')} jeux de fiches de révision à retourner.`,
    ],
    [
      fa.FaClipboardCheck,
      'Valider',
      `${count(allActs, 'quiz')} quiz : la réussite débloque le module suivant.`,
    ],
  ];
  for (const [i, [Icon, head, body]] of steps.entries()) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.5 + col * 3.05;
    const y = 1.45 + row * 1.75;
    card(s, x, y, 2.85, 1.6);
    await badge(s, x + 0.2, y + 0.2, 0.5, Icon, i === 3 ? GREEN : ORANGE);
    text(s, head, {
      x: x + 0.85,
      y: y + 0.22,
      w: 1.8,
      h: 0.45,
      fontSize: 15,
      bold: true,
      fontFace: 'Cambria',
      valign: 'middle',
    });
    text(s, body, { x: x + 0.2, y: y + 0.8, w: 2.5, h: 0.75, fontSize: 11, color: SLATE });
  }
  s.addNotes(
    'Chaque module alterne leçons, exercices, une mise en situation, un TP, des fiches et un quiz. ' +
      "Les points d'expérience récompensent chaque activité, avec un bonus de 50 points par module terminé ; niveaux et badges (Premier pas, Module accompli, Sans faute, Stratège, Parcours terminé) suivent la progression. " +
      "Les résultats restent privés : l'apprenant choisit s'il publie sa réussite à son manager ou à tous.",
  );

  // 6+. Un module par diapositive
  pres.addSection({ title: 'Modules' });
  for (const [i, m] of f.modules.entries()) {
    s = pres.addSlide({ masterName: 'Contenu', sectionTitle: 'Modules' });
    s.addText(`MODULE ${i + 1} SUR ${f.modules.length} · ${m.dureeEstimeeMinutes} MIN`, {
      placeholder: 'eyebrow',
    });
    s.addText(m.titre, { placeholder: 'title', fontSize: m.titre.length > 48 ? 22 : 26 });

    // Colonne gauche : programme
    const lessons = m.activites.filter((a) => a.type === 'lecon').map((a) => a.titre);
    const scenario = m.activites.find((a) => a.type === 'scenario');
    const tp = m.activites.find((a) => a.type === 'pratique');
    text(s, 'Au programme', {
      x: 0.5,
      y: 1.42,
      w: 4.4,
      h: 0.3,
      fontSize: 13,
      bold: true,
      color: RUST,
    });
    text(s, bullets(lessons, { space: 3 }), { x: 0.5, y: 1.76, w: 4.4, h: 1.95, fontSize: 11.5 });
    // Mise en situation et TP
    const extras = [
      [fa.FaComments, ORANGE, 'Mise en situation', scenario?.titre],
      [fa.FaLaptopCode, GREEN, 'Travaux pratiques', tp?.titre.replace(/^TP : /, '')],
    ];
    for (const [j, [Icon, fill, head, body]] of extras.entries()) {
      if (!body) continue;
      const y = 3.8 + j * 0.65;
      await badge(s, 0.5, y + 0.03, 0.42, Icon, fill);
      text(
        s,
        [
          { text: head, options: { bold: true, breakLine: true, fontSize: 10, color: SLATE } },
          { text: body, options: { fontSize: 11.5 } },
        ],
        { x: 1.05, y, w: 3.85, h: 0.6 },
      );
    }

    // Colonne droite : objectifs
    card(s, 5.2, 1.42, 4.3, 3.5);
    text(s, 'Vous saurez', {
      x: 5.45,
      y: 1.58,
      w: 3.8,
      h: 0.3,
      fontSize: 13,
      bold: true,
      color: RUST,
    });
    const objectives = m.objectifs.map((o) =>
      o.replace(/^Savoir /, '').replace(/^./, (c) => c.toUpperCase()),
    );
    text(s, bullets(objectives, { space: 4 }), {
      x: 5.45,
      y: 1.92,
      w: 3.85,
      h: 2.9,
      fontSize: objectives.join('').length > 560 ? 10 : 11,
      color: NAVY,
    });

    const mix = Object.keys(TYPES)
      .map((t) => [t, count(m.activites, t)])
      .filter(([, c]) => c)
      .map(([t, c]) => `${c} ${c > 1 ? TYPES[t].many : TYPES[t].one}`)
      .join(' · ');
    s.addNotes(
      `${m.resume}\n\nActivités (${m.activites.length}) : ${mix}.\n\n` +
        m.activites
          .map((a) => `- ${a.titre}${a.obligatoire === false ? ' (facultatif)' : ''}`)
          .join('\n') +
        `\n\nObjectifs :\n` +
        m.objectifs.map((o) => `- ${o}`).join('\n'),
    );
  }

  // Fin
  pres.addSection({ title: 'Conclusion' });
  s = pres.addSlide({ masterName: 'Fin', sectionTitle: 'Conclusion' });
  s.addText('Prêt à commencer ?', { placeholder: 'title' });
  const closing = [
    {
      text: "Le parcours est disponible dans l'onglet « Mon parcours en ligne » de 3S - Pro Learning.",
      options: { breakLine: true },
    },
    {
      text: 'En autonomie, à votre rythme, sans validation manager ; votre progression est enregistrée.',
      options: { breakLine: true },
    },
  ];
  if (nextTitle)
    closing.push({
      text: `Et ensuite : le parcours « ${nextTitle} ».`,
      options: { color: ORANGE, bold: true },
    });
  else
    closing.push({
      text: "Vos résultats restent privés : c'est vous qui choisissez de les publier.",
      options: {},
    });
  s.addText(closing, { placeholder: 'body', paraSpaceAfter: 10 });
  await badge(s, 8.4, 4.0, 0.8, fa.FaRocket);
  s.addNotes(
    "Rappeler où trouver le parcours, qu'il se suit en autonomie et que les résultats sont visibles de l'apprenant seul, sauf s'il décide de les publier." +
      (nextTitle ? ` Suite conseillée : « ${nextTitle} ».` : ''),
  );

  await pres.writeFile({ fileName: output });
  await applyTheme(output, THEME);
  console.log('écrit :', output);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
