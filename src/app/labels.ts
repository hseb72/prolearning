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
  },
  home: {
    title: 'Bienvenue sur le portail de formation',
    intro:
      'Catalogue, sessions à distance et sur site, demandes d’inscription et parcours en ligne : le portail est en cours de construction.',
    healthHeading: 'État du service',
    healthChecking: 'Vérification en cours…',
    healthOk: 'Le service est disponible.',
    healthDegraded: 'Le service fonctionne en mode dégradé.',
    healthDown: 'Le service est indisponible pour le moment.',
  },
  notFound: {
    title: 'Page introuvable',
    text: 'L’adresse demandée ne correspond à aucune page.',
    back: 'Revenir à l’accueil',
  },
} as const;
