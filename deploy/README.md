# Déploiement — 3S - Pro Learning sur la plateforme mutualisée

3S - Pro Learning suit le **pattern `shared`** de
[platform-patterns](https://github.com/hseb72/platform-patterns). Il se pose sur le socle
décrit dans [homelab-platform](https://github.com/hseb72/homelab-platform) :
ingress-nginx, Kong, cert-manager, PostgreSQL mutualisé. Ce dépôt ne déploie **que**
l'application, dans un seul namespace : `prolearning`. Le modèle suivi est celui de
[treasurehunters](https://github.com/hseb72/treasurehunters/tree/master/deploy).

## Le chemin d'une requête

```
Internet
   │
   ▼
ingress-nginx (ns platform-ingress) ── TLS cert-manager + WAF
   │
   ├──▶ prolearning.crealcs.com ──────▶ web (nginx, ns prolearning)
   │        pages, retour Keycloak            │
   │                                          └── relaie /api ──┐
   │                                                            ▼
   └──▶ api.prolearning.crealcs.com ──▶ kong-proxy (ns gateway)
                                                │  Ingress classe kong
                                                ▼
                                        api (Node.js, ns prolearning)
                                          │                  │
                                          ▼                  ▼
                           PostgreSQL mutualisé (ns database)   Keycloak Soredi
                           base prolearning       (production)  sso.crealcs.com
                           base prolearning_demo  (démo)
```

Le front appelle l'API en chemin relatif (`/api`), sous la même origine : pas de CORS,
et le cookie de session reste celui du front. Le relais passe par Kong, jamais
directement par l'API.

## Ce qui vient d'où

| Élément                                                                                                 | Source                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deployments / Services `web` et `api`, ConfigMap `api-config`, PDB, NetworkPolicy « Kong seulement »    | chart `app` de platform-patterns (OCI, **épinglé**), valeurs [`values.yaml`](values.yaml)                                                                |
| Tag des images                                                                                          | `deploy/values-image.yaml` sur la branche **`deploy-state`**, écrit par la CI                                                                            |
| Ce qu'Argo CD lit                                                                                       | la branche d'environnement **`deploy-state`** : copie de `deploy/` depuis `master`, plus le tag d'image. Tenue à jour par `.github/workflows/deploy.yml` |
| Ingress nginx du front, Ingress kong de l'API, entrée ingress-nginx → web                               | [`manifests/`](manifests/)                                                                                                                               |
| Secret `prolearning-api-secrets` (`DATABASE_URL_PRODUCTION`, `DATABASE_URL_DEMO`, `OIDC_CLIENT_SECRET`) | créé **directement dans le cluster** par [`create-secrets.sh`](create-secrets.sh), jamais versionné                                                      |
| Bases + rôles `prolearning` et `prolearning-demo`, hôte public de l'API                                 | **socle** (homelab-platform)                                                                                                                             |
| Client OIDC `pro-learning`                                                                              | Keycloak de Soredi, royaume `soredi` ([`docs/keycloak.md`](../docs/keycloak.md))                                                                         |

L'API applique elle-même les migrations SQL au démarrage, aux deux bases, sous verrou
PostgreSQL : les deux répliques peuvent démarrer ensemble. Au premier démarrage, elle
crée aussi les comptes fictifs de l'espace démonstration (`fixtures/demo/comptes.json`).

## Première installation

**0. Prérequis côté pattern — chart publié.** L'Application référence
`oci://ghcr.io/hseb72/platform-patterns/app:0.4.0`, déjà utilisé par treasurehunters :
Argo CD sait déjà lire ce registre.

**1. Côté socle (homelab-platform) — deux locataires.** Le socle donne à chaque
locataire **une** base et **un** rôle ; une base par espace demande donc deux locataires,
dans le même namespace `prolearning` :

| Locataire          | Base                               | Hôte d'API                                             |
| ------------------ | ---------------------------------- | ------------------------------------------------------ |
| `prolearning`      | `prolearning` (production)         | `api.prolearning.crealcs.com`, port 5080, corps ≤ 200m |
| `prolearning-demo` | `prolearning_demo` (démonstration) | —                                                      |

Le plus court : une issue « Nouveau locataire » par locataire ; le guichet ouvre la PR.
Après fusion, sur le poste admin :

```bash
scripts/tenant-keys.sh prolearning --database --app-namespace prolearning
scripts/tenant-keys.sh prolearning-demo --database --app-namespace prolearning
argocd app sync database
scripts/verify-tenant.sh prolearning --app-namespace prolearning
scripts/verify-tenant.sh prolearning-demo --app-namespace prolearning
```

Le kit côté application que génère le guichet (namespace, NetworkPolicies, Ingress
kong) **n'est pas à reprendre** : son équivalent est déjà dans `argocd/application.yaml`
et `manifests/`. Son Ingress kong déclare en plus l'hôte interne
`kong-proxy.gateway.svc.cluster.local`, inutile ici (le front relaie avec l'hôte
public) et qui entrerait en conflit avec les autres applications.

**2. DNS.** Deux enregistrements vers l'IP publique de l'ingress, **avant** la demande
de certificat (HTTP-01) :

```
prolearning.crealcs.com.       A   <IP>
api.prolearning.crealcs.com.   A   <IP>
```

**3. Keycloak.** Client `pro-learning` dans le royaume `soredi`, réglé comme décrit
dans [`docs/keycloak.md`](../docs/keycloak.md) : client confidentiel, _standard flow_,
PKCE `S256`, redirection `https://prolearning.crealcs.com/api/auth/callback`,
déconnexion vers `https://prolearning.crealcs.com/connexion`.

**4. Images.** Le premier passage de la CI sur `master` publie
`ghcr.io/hseb72/prolearning/{web,api}:<sha>` et écrit ce SHA dans
`deploy/values-image.yaml`, sur la branche `deploy-state` (créée au premier passage).
Si les paquets GHCR sont privés, déclarer un `imagePullSecret`
(`global.imagePullSecrets` dans `values.yaml`) ou rendre les paquets publics.

**5. Secret de l'API**, créé directement dans le cluster. Les mots de passe des deux
bases sont lus dans `database/database-tenant-keys` (clés `prolearning` et
`prolearning-demo`) ; le secret Keycloak est fourni une fois :

```bash
OIDC_CLIENT_SECRET='…' ./deploy/create-secrets.sh
```

Relancé sans `OIDC_CLIENT_SECRET`, le script conserve celui en place. Si `kubeseal`
est installé, il produit aussi une copie scellée **hors du dépôt** (`~/sealed-secrets/`).

**6. Argo CD :**

```bash
kubectl apply -f deploy/argocd/project.yaml
kubectl apply -f deploy/argocd/application.yaml
kubectl -n argocd get application prolearning -w
```

À partir de là, rien ne se fait plus à la main : chaque commit sur `master` construit
les images, la CI promeut leur SHA sur la branche `deploy-state`, et Argo CD applique.

**7. Premier administrateur.** Se connecter avec le compte Soredi
`sebastien.raimondi@soredi-group.com` (`BOOTSTRAP_ADMIN_EMAILS` dans `values.yaml`) : il
reçoit le rôle d'administrateur et attribue ensuite les autres rôles depuis
« Comptes et rôles ».

## Vérifier

```bash
curl -fsS https://prolearning.crealcs.com/healthz              # front
curl -fsS https://prolearning.crealcs.com/api/health           # front → Kong → API → 2 bases
curl -fsS https://api.prolearning.crealcs.com/api/health       # nginx → Kong → API
kubectl -n prolearning logs deploy/api | grep -iE 'migration|comptes fictifs'
```

`/api/health` répond `{"status":"ok","databases":{"production":"ok","demo":"ok"}}`, ou
503 en désignant la base injoignable. Depuis la VM, ajouter
`--resolve <hôte>:443:<IP interne>` (hairpin, cf. homelab-platform/gateway/README.md).

L'API doit aussi joindre `https://sso.crealcs.com` (découverte OIDC, échange du code) :
si la connexion échoue avec « Le service de connexion Soredi est indisponible »,
vérifier depuis un pod que cet hôte répond (le même piège du hairpin peut s'y
appliquer si Keycloak tourne sur le même cluster).

## Retour arrière

```bash
git switch deploy-state
git revert <commit de promotion>   # Argo redéploie le SHA précédent
git push origin deploy-state
```

## Écarts connus avec le pattern

Les mêmes que treasurehunters (chart `app` 0.4.0, qui suppose une plateforme Gateway API) :

1. **Ingress kong** de l'API en manifeste local, l'`HTTPRoute` du chart désactivée.
2. **Ingress nginx** du front et l'entrée correspondante dans la NetworkPolicy.
3. **`securityContext`** absent des workloads : namespace en Pod Security `baseline`
   (avertissement `restricted`). Les images tournent déjà en non-root (uid 1000 pour
   l'API, 101 pour nginx).
4. **Provisionnement** des bases par le socle, celui du chart désactivé.
