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
