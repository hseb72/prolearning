import type { Role } from '@shared/roles';

/**
 * Textes de l'interface. Tous en français (cf. CLAUDE.md, « Langue ») et réunis ici :
 * un texte d'interface écrit ailleurs est une anomalie.
 */
export const LABELS = {
  app: {
    name: '3S - Pro Learning',
    tagline: 'Portail de formation',
    skipToContent: 'Aller au contenu',
    footer: '3S - Pro Learning — portail de formation interne',
    mainNav: 'Navigation principale',
    logout: 'Se déconnecter',
    connectedAs: 'Connecté en tant que',
    playingAs: 'Rôle joué',
  },
  nav: {
    home: 'Accueil',
    learning: 'Parcours en ligne',
    formations: 'Formations',
    users: 'Comptes et rôles',
  },
  roles: {
    employee: 'Collaborateur',
    manager: 'Manager',
    training: 'Équipe formation',
    admin: 'Administrateur',
  } satisfies Record<Role, string>,
  space: {
    productionBanner: 'Espace production — données réelles',
    demoBanner: 'Espace démonstration — données fictives',
    toDemo: 'Passer en démonstration',
    toProduction: 'Revenir en production',
    persona: 'Compte joué',
    switchFailed: 'La bascule d’espace a échoué. Réessayez.',
  },
  login: {
    title: 'Connexion',
    intro: 'Connectez-vous avec votre compte Soredi pour accéder au portail de formation.',
    sso: 'Se connecter avec le compte Soredi',
    ssoUnavailable: 'La connexion par compte Soredi n’est pas configurée sur cette installation.',
    devTitle: 'Connexion de développement',
    devWarning:
      'Sans mot de passe : réservée au développement et aux tests, elle est désactivée en production.',
    devEmail: 'Adresse e-mail',
    devSubmit: 'Se connecter',
    devInvalid: 'Saisissez une adresse e-mail valide.',
    errors: {
      'sso-indisponible': 'Le service de connexion Soredi est indisponible. Réessayez plus tard.',
      'sso-refuse': 'La connexion a expiré ou a été refusée. Recommencez.',
      'sso-echec':
        'La connexion a échoué. Réessayez ; si le problème persiste, contactez l’équipe formation.',
      'compte-desactive': 'Votre compte est désactivé. Contactez l’équipe formation.',
    } as Record<string, string>,
  },
  home: {
    title: 'Bienvenue sur le portail de formation',
    greeting: (name: string) => `Bonjour ${name}`,
    intro:
      'Catalogue, sessions à distance et sur site, demandes d’inscription et parcours en ligne : le portail est en cours de construction.',
    healthHeading: 'État du service',
    healthChecking: 'Vérification en cours…',
    healthOk: 'Le service est disponible.',
    healthDegraded: 'Le service fonctionne en mode dégradé.',
    healthDown: 'Le service est indisponible pour le moment.',
  },
  users: {
    title: 'Comptes et rôles',
    intro:
      'Les rôles et les rattachements aux managers sont tenus ici. L’identité de chacun vient du compte Soredi.',
    demoNote: 'Vous modifiez les comptes fictifs de l’espace démonstration.',
    name: 'Nom',
    email: 'Adresse e-mail',
    role: 'Rôle',
    manager: 'Manager',
    lastLogin: 'Dernière connexion',
    never: 'Jamais',
    noManager: 'Aucun',
    loading: 'Chargement des comptes…',
    loadFailed: 'Impossible de charger les comptes.',
    saved: (name: string) => `Modification enregistrée pour ${name}.`,
    saveFailed: 'La modification n’a pas été enregistrée.',
    roleOf: (name: string) => `Rôle de ${name}`,
    managerOf: (name: string) => `Manager de ${name}`,
  },
  learning: {
    title: 'Parcours en ligne',
    intro:
      'Des formations à suivre en autonomie, à votre rythme. Votre progression n’est visible que de vous.',
    empty: 'Aucun parcours en ligne n’est encore publié.',
    loading: 'Chargement…',
    loadFailed: 'Impossible de charger le parcours.',
    profileHeading: 'Votre progression',
    points: (n: number) => `${n} point${n > 1 ? 's' : ''}`,
    level: (numero: number, nom: string) => `Niveau ${numero} — ${nom}`,
    nextLevel: (n: number) => `${n} points pour le niveau suivant`,
    maxLevel: 'Niveau maximal atteint',
    badges: 'Badges',
    noBadge: 'Pas encore de badge : terminez une première activité.',
    modules: (done: number, total: number) =>
      `${done} module${done > 1 ? 's' : ''} terminé${done > 1 ? 's' : ''} sur ${total}`,
    duration: (minutes: number) =>
      minutes >= 60
        ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`
        : `${minutes} min`,
    levels: { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' } as Record<
      string,
      string
    >,
    open: 'Ouvrir le parcours',
    openLabel: (titre: string) => `Ouvrir le parcours « ${titre} »`,
    audience: 'Public',
    prerequisites: 'Prérequis',
    objectives: 'Objectifs',
    rights: 'Droits et mentions',
    glossary: 'Glossaire',
    modulesHeading: 'Modules',
    moduleLocked: 'Verrouillé : terminez le module précédent',
    moduleDone: 'Terminé',
    moduleOpen: 'À suivre',
    start: 'Commencer',
    resume: 'Reprendre',
    review: 'Revoir',
    activitiesNav: 'Activités du module',
    backToFormation: 'Retour au parcours',
    previous: 'Activité précédente',
    next: 'Activité suivante',
    optional: 'facultative',
    status: {
      'a-faire': 'À faire',
      faite: 'Faite',
      reussie: 'Réussie',
      echouee: 'À refaire',
    } as Record<string, string>,
    types: {
      lecon: 'Leçon',
      diaporama: 'Diaporama',
      quiz: 'Quiz',
      ordre: 'Remettre dans l’ordre',
      association: 'Associer',
      scenario: 'Cas pratique',
      fiches: 'Fiches de révision',
    } as Record<string, string>,
    markDone: 'J’ai terminé',
    marked: 'Activité terminée.',
    earned: (n: number) => `+${n} points`,
    moduleCompleted: 'Bravo, module terminé ! Le suivant est débloqué.',
    failed: 'L’opération a échoué. Réessayez.',
    lockedMessage: 'Ce module s’ouvrira quand le précédent sera terminé.',
    // Leçon
    variants: {
      a_retenir: 'À retenir',
      attention: 'Attention',
      exemple: 'Exemple',
      cas: 'Cas',
      definition: 'Définition',
    } as Record<string, string>,
    goFurther: 'Approfondir',
    references: 'Références',
    access: {
      libre: 'accès libre',
      inscription: 'inscription gratuite requise',
      payant: 'payant',
      interne: 'ressource interne',
    } as Record<string, string>,
    imageMissing: (alt: string) => `Image non disponible : ${alt}`,
    video: (titre: string) => `Voir la vidéo « ${titre} »`,
    transcript: 'Transcription',
    // Diaporama
    slide: (n: number, total: number) => `Diapositive ${n} sur ${total}`,
    previousSlide: 'Diapositive précédente',
    nextSlide: 'Diapositive suivante',
    // Quiz
    quizIntro: (n: number, seuil: number) =>
      `${n} question${n > 1 ? 's' : ''}. Réussite à partir de ${Math.round(seuil * 100)} % de bonnes réponses.`,
    quizStart: 'Commencer le quiz',
    quizRetry: 'Recommencer le quiz',
    quizSubmit: 'Valider mes réponses',
    question: (n: number, total: number) => `Question ${n} sur ${total}`,
    hint: 'Indice',
    multiple: 'Plusieurs réponses possibles.',
    quizResult: (ok: number, total: number) =>
      `${ok} bonne${ok > 1 ? 's' : ''} réponse${ok > 1 ? 's' : ''} sur ${total}.`,
    quizPassed: 'Quiz réussi.',
    quizFailed: 'Quiz non réussi : relisez les explications et recommencez.',
    correct: 'Bonne réponse',
    incorrect: 'Réponse incorrecte',
    expected: 'Réponse attendue :',
    // Ordre
    moveUp: (texte: string) => `Monter « ${texte} »`,
    moveDown: (texte: string) => `Descendre « ${texte} »`,
    position: (n: number, total: number) => `Position ${n} sur ${total}`,
    check: 'Vérifier',
    retry: 'Réessayer',
    orderRight: 'Bon ordre !',
    orderWrong: 'Pas tout à fait. Voici l’ordre attendu :',
    // Association
    choose: 'Choisir…',
    matchFor: (gauche: string) => `Associer « ${gauche} »`,
    matchRight: 'Toutes les associations sont justes !',
    matchWrong: 'Certaines associations sont à revoir. Les bonnes réponses :',
    // Cas pratique
    scenarioStart: 'Commencer le cas pratique',
    scenarioRestart: 'Rejouer le cas pratique',
    yourChoice: 'Votre choix',
    feedback: 'Retour',
    stars: (n: number) => `${n} étoile${n > 1 ? 's' : ''} sur 3`,
    // Fiches
    card: (n: number, total: number) => `Fiche ${n} sur ${total}`,
    previousCard: 'Fiche précédente',
    nextCard: 'Fiche suivante',
    flip: 'Retourner la fiche',
    front: 'Recto',
    back: 'Verso',
  },
  formations: {
    title: 'Formations',
    intro:
      'Importez une formation au format d’échange 3S (fichier .formation.json), relisez-la en démonstration, puis publiez-la en production.',
    productionNote:
      'L’import se fait dans l’espace démonstration, pour relire la formation avant de la publier. Passez en démonstration pour importer.',
    importHeading: 'Importer une formation',
    file: 'Fichier .formation.json',
    fileHint:
      '10 Mo au plus. Les archives .formation.zip (avec images) arriveront avec le stockage de fichiers.',
    replace: 'Remplacer la version si elle existe déjà',
    check: 'Vérifier le fichier',
    import: 'Importer en démonstration',
    noFile: 'Choisissez d’abord un fichier.',
    working: 'Traitement en cours…',
    reportHeading: 'Rapport de validation',
    reportOk: (titre: string, version: string) =>
      `Fichier valide : « ${titre} », version ${version}.`,
    reportKo: (count: number) =>
      count === 1
        ? 'Fichier refusé : 1 erreur bloquante.'
        : `Fichier refusé : ${count} erreurs bloquantes.`,
    errors: 'Erreurs bloquantes',
    warnings: 'Avertissements',
    root: 'racine du fichier',
    imported: {
      nouvelle: 'Formation importée en démonstration.',
      'nouvelle-version': 'Nouvelle version importée en démonstration.',
      remplacement: 'Version remplacée en démonstration.',
    } as Record<string, string>,
    refused: (reason: string) => `Import refusé : ${reason}`,
    failed: 'L’opération a échoué. Réessayez.',
    listHeading: 'Formations de cet espace',
    empty: 'Aucune formation dans cet espace.',
    loading: 'Chargement des formations…',
    loadFailed: 'Impossible de charger les formations.',
    columnTheme: 'Thème',
    columnVersions: 'Versions',
    current: 'courante',
    importedOn: (date: string, by: string | null) =>
      by ? `Importée le ${date} par ${by}` : `Importée le ${date}`,
    publishedOn: (date: string) => `Publiée en production le ${date}`,
    export: 'Exporter',
    exportLabel: (titre: string, version: string) => `Exporter « ${titre} », version ${version}`,
    publish: 'Publier en production',
    publishLabel: (titre: string, version: string) =>
      `Publier « ${titre} », version ${version}, en production`,
    publishConfirm: (titre: string, version: string) =>
      `Publier « ${titre} », version ${version}, en production ? Les collaborateurs y auront accès.`,
    published: (version: string) => `Version ${version} publiée en production.`,
    publishRefused: (reason: string) => `Publication refusée : ${reason}`,
  },
  notFound: {
    title: 'Page introuvable',
    text: 'L’adresse demandée ne correspond à aucune page.',
    back: 'Revenir à l’accueil',
  },
  forbidden: {
    title: 'Accès non autorisé',
    text: 'Votre rôle ne donne pas accès à cette page.',
  },
} as const;
