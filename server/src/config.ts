import { z } from 'zod';

const flag = z
  .enum(['true', 'false', '1', '0', ''])
  .default('false')
  .transform((value) => value === 'true' || value === '1');

const emailList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // Une base par espace (cf. CLAUDE.md, « Décisions de démarrage », point 3).
  DATABASE_URL_PRODUCTION: z.string().url(),
  DATABASE_URL_DEMO: z.string().url(),
  // Adresse publique du front : base des redirections OIDC (le front relaie /api).
  APP_URL: z.string().url().default('http://localhost:4200'),
  SESSION_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  // SSO Keycloak. Les trois valeurs vont ensemble ; le secret vient d'un Secret Kubernetes.
  OIDC_ISSUER: z.string().url().optional(),
  OIDC_CLIENT_ID: z.string().min(1).optional(),
  OIDC_CLIENT_SECRET: z.string().min(1).optional(),
  // Connexion de développement par simple e-mail, sans mot de passe. Interdite en production.
  AUTH_DEV_LOGIN: flag,
  // E-mails promus administrateurs à leur connexion : amorçage des premiers comptes.
  BOOTSTRAP_ADMIN_EMAILS: emailList,
});

export type Config = z.infer<typeof schema> & { oidc: OidcConfig | null };

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
}

/** Lit et vérifie la configuration ; s'arrête avec un message explicite si elle est incomplète. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = schema.safeParse(env);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')} : ${issue.message}`)
      .join('\n');
    throw new Error(`Configuration invalide :\n${details}`);
  }
  const data = result.data;
  const fail = (message: string): never => {
    throw new Error(`Configuration invalide : ${message}`);
  };

  if (data.DATABASE_URL_PRODUCTION === data.DATABASE_URL_DEMO) {
    fail('DATABASE_URL_PRODUCTION et DATABASE_URL_DEMO désignent la même base.');
  }

  const oidcValues = [data.OIDC_ISSUER, data.OIDC_CLIENT_ID, data.OIDC_CLIENT_SECRET];
  if (oidcValues.some(Boolean) && !oidcValues.every(Boolean)) {
    fail('OIDC_ISSUER, OIDC_CLIENT_ID et OIDC_CLIENT_SECRET vont ensemble.');
  }
  const oidc = data.OIDC_ISSUER
    ? {
        issuer: data.OIDC_ISSUER,
        clientId: data.OIDC_CLIENT_ID!,
        clientSecret: data.OIDC_CLIENT_SECRET!,
      }
    : null;

  if (data.NODE_ENV === 'production') {
    if (data.AUTH_DEV_LOGIN) fail('AUTH_DEV_LOGIN est interdit en production.');
    if (!oidc) fail('le SSO (OIDC_*) est obligatoire en production.');
    if (!data.APP_URL.startsWith('https://')) fail('APP_URL doit être en https en production.');
  }
  if (!oidc && !data.AUTH_DEV_LOGIN) {
    fail('aucun mode de connexion : configurer OIDC_* ou AUTH_DEV_LOGIN=true.');
  }

  return { ...data, oidc };
}
