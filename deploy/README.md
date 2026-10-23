# Déploiement — 3S - Pro Learning sur la plateforme mutualisée

3S - Pro Learning suit le **pattern `shared`** de
[platform-patterns](https://github.com/hseb72/platform-patterns) (chart `app`
**1.0.0**). Il se pose sur le socle décrit dans
[homelab-platform](https://github.com/hseb72/homelab-platform) : ingress-nginx,
Kong, cert-manager, PostgreSQL mutualisé **CloudNativePG**, Keycloak et SealedSecrets.

Modèle réaligné (1.0.0) : le chart POSSÈDE **deux namespaces** et y rend tout —
`ui-prolearning` (front) et `api-prolearning` (API). Plus de `deploy/manifests/` :
le chart rend les deux Ingress et les NetworkPolicies.

## Le chemin d'une requête

```
Internet
   │
   ▼
ingress-nginx (ns ingress) ── TLS cert-manager + WAF
   │
   ├──▶ prolearning.crealcs.com ──────▶ web (nginx, ns ui-prolearning)
   │        pages, retour Keycloak            │
   │                                          └── relaie /api ──┐
   │                                                            ▼
   └──▶ api.prolearning.crealcs.com ──▶ kong-proxy (ns kong)
                                                │  Ingress classe kong
                                                ▼
                                        api (Node.js, ns api-prolearning)
                                          │                  │
                                          ▼                  ▼
                           PostgreSQL CNPG (ns postgres)   Keycloak Soredi
                           postgres-rw :                   sso.crealcs.com
                             prolearning       (production)  realm `soredi`
                             prolearning_demo  (démo)
                             prolearning_eval  (évaluation)
```

Le front appelle l'API en chemin relatif (`/api`), sous la même origine : pas de CORS,
et le cookie de session reste celui du front. Le relais passe par Kong, jamais
directement par l'API.

## Ce qui vient d'où

| Élément | Source |
|---|---|
| Deployments / Services `web` et `api`, ConfigMap `api-config`, PDB, les **deux Ingress** (nginx du front, kong de l'API) et les **NetworkPolicies** | chart `app` 1.0.0 de platform-patterns (OCI, **épinglé**), valeurs [`values.yaml`](values.yaml) |
| Tag des images | `deploy/values-image.yaml` sur la branche **`deploy-state`**, écrit par la CI |
| Secret `prolearning-api-secrets` (`DB_PASSWORD`, `DEMO_DB_PASSWORD`, `EVAL_DB_PASSWORD`, `DATABASE_URL_PRODUCTION`, `DATABASE_URL_DEMO`, `DATABASE_URL_EVALUATION`, `OIDC_CLIENT_SECRET`) | créé **dans le cluster** par [`create-secrets.sh`](create-secrets.sh), jamais versionné |
| Bases/rôles `prolearning`, `prolearning-demo`, `prolearning-eval` (CNPG) | provisionnés **hors-bande** ; hôte public de l'API amené à kong-proxy par le **socle** (gateway) |
| Client OIDC `pro-learning` | Keycloak de Soredi, realm `soredi` ([`docs/keycloak.md`](../docs/keycloak.md)) |

Le chart pose `platform-patterns.io/postgres-client` sur `api-prolearning` — une
seule étiquette couvre les trois connexions. Les images tournent en non-root
numérique (uid 1000 API, 101 nginx) : le `securityContext` `restricted` du chart
passe sans réglage.

L'API applique elle-même les migrations SQL au démarrage, aux trois bases, sous
verrou PostgreSQL. Au premier démarrage, si la base démo est vide, elle charge le
jeu de démonstration (`fixtures/demo/`). La base d'évaluation n'est jamais
réinitialisée.

> **Provisionnement hors-bande (ce cluster).** Deux raisons : la latence
> d'indexation kube-router fait échouer le Job PreSync (cf. mtgwars), ET le chart
> ne provisionne qu'UNE base là où prolearning en a trois. Les trois rôles + bases
> sont donc créés une fois à la main dans CNPG (runbook de bascule), avec les mots
> de passe DB_PASSWORD / DEMO_DB_PASSWORD / EVAL_DB_PASSWORD du Secret.

## Première installation

**0. Chart publié.** L'Application référence `oci://ghcr.io/hseb72/platform-patterns/app:1.0.0`.

**1. Côté socle (homelab-platform) — trois bases, hors-bande.** Dans le PostgreSQL
CNPG, créer les trois rôles et bases (mots de passe = `*_DB_PASSWORD` du Secret de
l'étape 5) :

| Rôle | Base |
|---|---|
| `prolearning` | `prolearning` (production) |
| `prolearning-demo` | `prolearning_demo` (démonstration) |
| `prolearning-eval` | `prolearning_eval` (évaluation) |

L'hôte `api.prolearning.crealcs.com` est déjà amené à kong-proxy par le socle
(`gateway/10-ingress-api-hosts.yaml`).

**2. DNS.** Deux enregistrements vers l'IP publique de l'ingress, **avant** la
demande de certificat (HTTP-01) : `prolearning.crealcs.com` et `api.prolearning.crealcs.com`.

**3. Keycloak.** Client `pro-learning` dans le realm `soredi`
([`docs/keycloak.md`](../docs/keycloak.md)) : confidentiel, _standard flow_, PKCE
`S256`, redirection `https://prolearning.crealcs.com/api/auth/callback`,
déconnexion vers `https://prolearning.crealcs.com/connexion`. L'hôte et les URLs
ne changent pas : rien à refaire côté Keycloak lors de la bascule.

**4. Images.** Le passage de la CI sur `master` publie
`ghcr.io/hseb72/prolearning/{web,api}:<sha>` et écrit ce SHA sur `deploy-state`.
Images GHCR privées tirées via l'auth du **nœud** (`registries.yaml`).

**5. Secret de l'API** (ns `api-prolearning`) :

```bash
OIDC_CLIENT_SECRET='…' ./deploy/create-secrets.sh
```

Les trois `*_DB_PASSWORD` sont tirés au hasard la première fois puis conservés (ou
passés en ligne de commande pour reprendre des valeurs existantes). Relancé sans
`OIDC_CLIENT_SECRET`, le script conserve celui en place.

**6. Argo CD :**

```bash
kubectl apply -f deploy/argocd/project.yaml
kubectl apply -f deploy/argocd/application.yaml
kubectl -n argocd get application prolearning -w
```

**7. Premier administrateur.** Se connecter avec un compte de `BOOTSTRAP_ADMIN_EMAILS`
(dans `values.yaml`) : il reçoit le rôle d'administrateur et attribue ensuite les
autres rôles depuis « Comptes et rôles ».

## Vérifier

```bash
curl -fsS https://prolearning.crealcs.com/healthz              # front
curl -fsS https://prolearning.crealcs.com/api/health           # front → Kong → API → 3 bases
curl -fsS https://api.prolearning.crealcs.com/api/health       # nginx → Kong → API
kubectl -n api-prolearning logs deploy/api | grep -iE 'migration|jeu chargé'
```

`/api/health` répond `{"status":"ok","databases":{"production":"ok","demo":"ok","evaluation":"ok"}}`,
ou 503 en désignant la base injoignable. Depuis la VM, ajouter
`--resolve <hôte>:443:<IP interne>` (hairpin, cf. homelab-platform/gateway/README.md).

L'API doit aussi joindre `https://sso.crealcs.com` (découverte OIDC, échange du
code) ; Keycloak tourne sur le même cluster (ns `sso`), le piège du hairpin peut
s'y appliquer.

## Retour arrière

```bash
git switch deploy-state
git revert <commit de promotion>   # Argo redéploie le SHA précédent
git push origin deploy-state
```
