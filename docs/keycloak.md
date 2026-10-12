# Connexion par le Keycloak de Soredi

La plateforme se connecte au Keycloak de Soredi en OIDC, flux « authorization code »
avec PKCE, client confidentiel. Keycloak ne fait que prouver l'identité de la personne
(`sub`, e-mail, nom). Les rôles et les rattachements aux managers sont gérés dans
l'application (page « Comptes et rôles »).

## Client à déclarer dans Keycloak

Royaume `soredi` sur `https://sso.crealcs.com`.

| Réglage                         | Valeur                                                                      |
| ------------------------------- | --------------------------------------------------------------------------- |
| Client ID                       | `pro-learning` (valeur de `OIDC_CLIENT_ID` dans `deploy/values.yaml`)       |
| Client authentication           | activé (client confidentiel)                                                |
| Authentication flow             | _Standard flow_ seulement (pas d'_implicit_, pas de _direct access grants_) |
| PKCE                            | méthode `S256` (_Advanced → Proof Key for Code Exchange_)                   |
| Valid redirect URIs             | `https://prolearning.crealcs.com/api/auth/callback`                         |
| Valid post logout redirect URIs | `https://prolearning.crealcs.com/connexion`                                 |
| Web origins                     | `https://prolearning.crealcs.com`                                           |
| Portées                         | `openid`, `email`, `profile` (portées par défaut)                           |

Chaque compte doit avoir une adresse e-mail : sans elle, la connexion est refusée.

## Configuration de l'API

| Variable                 | Valeur                                                                        |
| ------------------------ | ----------------------------------------------------------------------------- |
| `OIDC_ISSUER`            | `https://sso.crealcs.com/realms/soredi`                                       |
| `OIDC_CLIENT_ID`         | `pro-learning`                                                                |
| `OIDC_CLIENT_SECRET`     | le secret du client — **dans le Secret Kubernetes de l'API, jamais dans Git** |
| `APP_URL`                | `https://prolearning.crealcs.com`                                             |
| `BOOTSTRAP_ADMIN_EMAILS` | e-mails des premiers administrateurs, séparés par des virgules                |

Les administrateurs d'amorçage reçoivent le rôle d'administrateur à leur connexion ; ils
attribuent ensuite les autres rôles depuis l'application. La connexion de développement
(`AUTH_DEV_LOGIN`) est refusée au démarrage quand `NODE_ENV=production`.

## Parcours

1. « Se connecter avec le compte Soredi » → `GET /api/auth/login` : l'API enregistre
   l'état, le vérificateur PKCE et le nonce (10 minutes), puis redirige vers Keycloak.
2. Keycloak renvoie vers `/api/auth/callback` (relayé par le front, même origine). L'API
   vérifie l'état (usage unique), échange le code, valide le jeton d'identité et le nonce.
3. Le compte est retrouvé par `sub`, ou à défaut par e-mail, ou créé avec le rôle
   collaborateur. Une session est ouverte : cookie `pl_session` `HttpOnly`, `Secure`,
   `SameSite=Lax` ; seule l'empreinte SHA-256 du jeton est stockée.
4. La déconnexion ferme la session de l'application puis celle de Keycloak.
