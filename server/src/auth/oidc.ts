import * as client from 'openid-client';
import type pg from 'pg';
import type { OidcConfig } from '../config.js';

/** Durée de validité d'une connexion en cours (aller-retour avec Keycloak). */
const REQUEST_MINUTES = 10;

export interface OidcIdentity {
  subject: string;
  email: string;
  displayName: string;
}

/**
 * Connexion par Keycloak : flux « authorization code » avec PKCE et nonce, client
 * confidentiel. L'état de chaque connexion en cours est gardé en base de production.
 */
export class OidcLogin {
  private configuration: Promise<client.Configuration> | null = null;

  constructor(
    private readonly settings: OidcConfig,
    private readonly redirectUri: string,
    private readonly options: { allowInsecureIssuer?: boolean } = {},
  ) {}

  /** Découverte de l'émetteur, mise en cache (et réessayée si elle a échoué). */
  private config(): Promise<client.Configuration> {
    this.configuration ??= client
      .discovery(
        new URL(this.settings.issuer),
        this.settings.clientId,
        this.settings.clientSecret,
        undefined,
        this.options.allowInsecureIssuer ? { execute: [client.allowInsecureRequests] } : undefined,
      )
      .catch((err: unknown) => {
        this.configuration = null;
        throw err;
      });
    return this.configuration;
  }

  /** Prépare une connexion et renvoie l'adresse Keycloak vers laquelle rediriger. */
  async start(production: pg.Pool, returnTo: string): Promise<URL> {
    const config = await this.config();
    const codeVerifier = client.randomPKCECodeVerifier();
    const state = client.randomState();
    const nonce = client.randomNonce();
    await production.query(
      `INSERT INTO pl_oidc_requests (state, code_verifier, nonce, return_to, expires_at)
       VALUES ($1, $2, $3, $4, now() + make_interval(mins => $5))`,
      [state, codeVerifier, nonce, returnTo, REQUEST_MINUTES],
    );
    return client.buildAuthorizationUrl(config, {
      redirect_uri: this.redirectUri,
      scope: 'openid email profile',
      code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
      code_challenge_method: 'S256',
      state,
      nonce,
    });
  }

  /**
   * Termine une connexion à partir de l'adresse de retour de Keycloak. L'état n'est
   * utilisable qu'une fois. Renvoie l'identité prouvée et la page où revenir.
   */
  async finish(
    production: pg.Pool,
    callbackUrl: URL,
  ): Promise<{ identity: OidcIdentity; returnTo: string }> {
    const config = await this.config();
    const state = callbackUrl.searchParams.get('state');
    if (!state) throw new OidcError('Retour de connexion sans paramètre « state ».');
    const pending = await production.query<{
      codeVerifier: string;
      nonce: string;
      returnTo: string;
    }>(
      `DELETE FROM pl_oidc_requests WHERE state = $1 AND expires_at > now()
       RETURNING code_verifier AS "codeVerifier", nonce, return_to AS "returnTo"`,
      [state],
    );
    const request = pending.rows[0];
    if (!request) throw new OidcError('Connexion inconnue ou expirée.');

    const tokens = await client.authorizationCodeGrant(config, callbackUrl, {
      pkceCodeVerifier: request.codeVerifier,
      expectedNonce: request.nonce,
      expectedState: state,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims) throw new OidcError('Jeton d’identité absent.');
    const email = typeof claims['email'] === 'string' ? claims['email'] : null;
    if (!email) throw new OidcError('Le compte Keycloak n’a pas d’adresse e-mail.');
    const name =
      (typeof claims['name'] === 'string' && claims['name']) ||
      [claims['given_name'], claims['family_name']]
        .filter((x) => typeof x === 'string')
        .join(' ') ||
      email;
    return {
      identity: { subject: claims.sub, email, displayName: name },
      returnTo: request.returnTo,
    };
  }

  /** Adresse de déconnexion Keycloak (ferme aussi la session SSO), si l'émetteur en a une. */
  async logoutUrl(postLogoutRedirectUri: string): Promise<URL | null> {
    const config = await this.config();
    if (!config.serverMetadata().end_session_endpoint) return null;
    return client.buildEndSessionUrl(config, {
      client_id: this.settings.clientId,
      post_logout_redirect_uri: postLogoutRedirectUri,
    });
  }
}

export class OidcError extends Error {}
