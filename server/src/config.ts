import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // Une base par espace (cf. CLAUDE.md, « Décisions de démarrage », point 3).
  DATABASE_URL_PRODUCTION: z.string().url(),
  DATABASE_URL_DEMO: z.string().url(),
});

export type Config = z.infer<typeof schema>;

/** Lit et vérifie la configuration ; s'arrête avec un message explicite si elle est incomplète. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = schema.safeParse(env);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')} : ${issue.message}`)
      .join('\n');
    throw new Error(`Configuration invalide :\n${details}`);
  }
  if (result.data.DATABASE_URL_PRODUCTION === result.data.DATABASE_URL_DEMO) {
    throw new Error(
      'Configuration invalide : DATABASE_URL_PRODUCTION et DATABASE_URL_DEMO désignent la même base.',
    );
  }
  return result.data;
}
