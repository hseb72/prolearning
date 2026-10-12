import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AuthConfig, Me } from '../../../shared/auth.js';
import { audit } from '../audit.js';
import { requireAuth, type RequestContext } from '../context.js';
import type { Databases } from '../databases.js';
import { setRole, toSummary, upsertDevUser, upsertSsoUser, type UserRecord } from '../users.js';
import { OidcError, type OidcLogin } from './oidc.js';
import { createSession, deleteSession, SESSION_COOKIE } from './sessions.js';

export interface AuthSettings {
  appUrl: string;
  sessionDays: number;
  devLogin: boolean;
  bootstrapAdmins: readonly string[];
  oidc: OidcLogin | null;
}

/** Page de connexion du front, et code d'erreur éventuel. */
const LOGIN_PAGE = '/connexion';

/** N'accepte qu'un chemin interne (« /… », pas « //hôte » ni une URL absolue). */
export function safeReturnTo(value: unknown): string {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) && value.length <= 512
    ? value
    : '/';
}

export function toMe(ctx: RequestContext): Me {
  return {
    user: toSummary(ctx.user),
    space: ctx.space,
    actor: toSummary(ctx.actor),
    canSwitchSpace: ctx.user.role === 'admin',
  };
}

export function registerAuthRoutes(
  app: FastifyInstance,
  databases: Databases,
  settings: AuthSettings,
): void {
  const production = databases.production;
  const secure = settings.appUrl.startsWith('https://');

  /** Ouvre la session (toujours en production) et pose le cookie. */
  async function openSession(
    request: FastifyRequest,
    reply: FastifyReply,
    user: UserRecord,
    method: 'sso' | 'dev',
  ): Promise<void> {
    let current = user;
    if (settings.bootstrapAdmins.includes(user.email.toLowerCase()) && user.role !== 'admin') {
      await setRole(production, user.id, 'admin');
      current = { ...user, role: 'admin' };
      await audit(production, {
        actorId: user.id,
        actorLabel: user.email,
        action: 'user.bootstrap_admin',
        details: { userId: user.id },
      });
    }
    const token = await createSession(
      production,
      current.id,
      settings.sessionDays,
      request.headers['user-agent'],
    );
    await audit(production, {
      actorId: current.id,
      actorLabel: current.email,
      action: 'login',
      details: { method },
    });
    reply.setCookie(SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: settings.sessionDays * 24 * 3600,
    });
  }

  app.get('/api/auth/config', async (): Promise<AuthConfig> => ({
    sso: settings.oidc !== null,
    devLogin: settings.devLogin,
  }));

  app.get('/api/auth/login', async (request, reply) => {
    if (!settings.oidc) return reply.redirect(`${LOGIN_PAGE}?erreur=sso-indisponible`);
    const returnTo = safeReturnTo((request.query as Record<string, unknown>)['retour']);
    try {
      const url = await settings.oidc.start(production, returnTo);
      return reply.redirect(url.href);
    } catch (err) {
      request.log.error({ err }, 'Keycloak injoignable');
      return reply.redirect(`${LOGIN_PAGE}?erreur=sso-indisponible`);
    }
  });

  app.get('/api/auth/callback', async (request, reply) => {
    if (!settings.oidc) return reply.redirect(`${LOGIN_PAGE}?erreur=sso-indisponible`);
    // L'adresse de retour enregistrée chez Keycloak est celle du front (qui relaie /api).
    const callbackUrl = new URL(request.url, settings.appUrl);
    try {
      const { identity, returnTo } = await settings.oidc.finish(production, callbackUrl);
      const user = await upsertSsoUser(production, identity);
      if (!user.active) return reply.redirect(`${LOGIN_PAGE}?erreur=compte-desactive`);
      await openSession(request, reply, user, 'sso');
      return reply.redirect(returnTo);
    } catch (err) {
      request.log.warn({ err }, 'Échec de la connexion SSO');
      const code = err instanceof OidcError ? 'sso-refuse' : 'sso-echec';
      return reply.redirect(`${LOGIN_PAGE}?erreur=${code}`);
    }
  });

  const devLoginBody = z.object({
    email: z.string().trim().toLowerCase().email().max(320),
    displayName: z.string().trim().min(1).max(200).optional(),
  });

  app.post('/api/auth/dev-login', async (request, reply) => {
    if (!settings.devLogin) {
      return reply.code(404).send({ error: 'not_found', message: 'Ressource introuvable.' });
    }
    const body = devLoginBody.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'invalid', message: 'Adresse e-mail invalide.' });
    }
    const email = body.data.email;
    const user = await upsertDevUser(production, {
      email,
      displayName: body.data.displayName ?? email.split('@')[0]!,
    });
    if (!user.active) {
      return reply.code(403).send({ error: 'forbidden', message: 'Ce compte est désactivé.' });
    }
    await openSession(request, reply, user, 'dev');
    return reply.code(204).send();
  });

  app.get('/api/auth/me', { preHandler: requireAuth }, async (request) => toMe(request.auth!));

  app.post('/api/auth/logout', async (request, reply) => {
    const ctx = request.auth;
    if (ctx) {
      await deleteSession(production, ctx.token);
      await audit(production, {
        actorId: ctx.user.id,
        actorLabel: ctx.user.email,
        action: 'logout',
      });
    }
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    // Fermer aussi la session Keycloak : sinon « se reconnecter » serait immédiat.
    let redirect = LOGIN_PAGE;
    if (settings.oidc) {
      const url = await settings.oidc
        .logoutUrl(new URL(LOGIN_PAGE, settings.appUrl).href)
        .catch(() => null);
      if (url) redirect = url.href;
    }
    return { redirect };
  });
}
