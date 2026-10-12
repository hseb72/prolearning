#!/usr/bin/env bash
# Crée le Secret de l'API directement dans le cluster, comme treasurehunters. Aucun
# secret n'est versionné dans ce dépôt.
#
#   [OIDC_CLIENT_SECRET=<secret Keycloak>] [DB_PASSWORD=…] [DEMO_DB_PASSWORD=…] \
#     ./deploy/create-secrets.sh
#
# Les deux mots de passe de base sont lus dans le cluster s'ils ne sont pas fournis
# (Secret database/database-tenant-keys, clés `prolearning` et `prolearning-demo`) :
# ce sont les valeurs que le socle donne aux deux rôles PostgreSQL, on ne peut donc
# pas se tromper. Ils sont encodés pour l'URL (caractères spéciaux admis).
#
# OIDC_CLIENT_SECRET : secret du client Keycloak `pro-learning` (onglet Credentials).
# Obligatoire au premier passage ; ensuite, absent, la valeur déjà en place est
# conservée. Ne jamais le committer ni le coller dans un ticket.
#
# Relancer le script met le Secret à jour (rotation) ; les pods de l'API le relisent
# au redémarrage :
#   kubectl -n prolearning rollout restart deploy/api
#
# Si `kubeseal` est installé, une copie SCELLÉE est aussi produite, HORS du dépôt
# (SEALED_DIR, par défaut ~/sealed-secrets), à conserver avec celles des autres
# applications du cluster.
set -euo pipefail

NS=prolearning
NAME=prolearning-api-secrets
DB_HOST=postgres.database.svc.cluster.local:5432

# Valeur d'un Secret existant (vide s'il n'existe pas).
secret_value() {
  kubectl -n "$1" get secret "$2" -o "jsonpath={.data.$3}" 2>/dev/null | base64 -d 2>/dev/null || true
}

# Encodage « pourcent » : un @, :, /, # ou % dans le mot de passe casserait l'URL.
urlencode() {
  local LC_ALL=C s="$1" out="" c i
  for ((i = 0; i < ${#s}; i++)); do
    c="${s:i:1}"
    case "$c" in
      [a-zA-Z0-9._~-]) out+="$c" ;;
      *) printf -v c '%%%02X' "'$c"; out+="$c" ;;
    esac
  done
  printf '%s' "$out"
}

# Mot de passe d'un locataire du socle : fourni, ou lu dans database-tenant-keys.
tenant_password() {
  local given="$1" tenant="$2" value
  if [[ -n "$given" ]]; then printf '%s' "$given"; return; fi
  value="$(secret_value database database-tenant-keys "$tenant")"
  [[ -n "$value" ]] || {
    echo "✗ Clé « $tenant » absente de database/database-tenant-keys : le locataire est-il provisionné ?" >&2
    exit 1
  }
  echo "ℹ Mot de passe du locataire $tenant lu dans database/database-tenant-keys." >&2
  printf '%s' "$value"
}

DB_PASSWORD="$(tenant_password "${DB_PASSWORD:-}" prolearning)"
DEMO_DB_PASSWORD="$(tenant_password "${DEMO_DB_PASSWORD:-}" prolearning-demo)"

# `sslmode=disable` : le PostgreSQL du socle n'offre pas TLS (le cloisonnement y est
# assuré par les NetworkPolicies), et `prefer` ferait exiger TLS au pilote.
DATABASE_URL_PRODUCTION="postgresql://prolearning:$(urlencode "$DB_PASSWORD")@$DB_HOST/prolearning?sslmode=disable"
DATABASE_URL_DEMO="postgresql://prolearning-demo:$(urlencode "$DEMO_DB_PASSWORD")@$DB_HOST/prolearning_demo?sslmode=disable"

OIDC_CLIENT_SECRET="${OIDC_CLIENT_SECRET:-$(secret_value "$NS" "$NAME" OIDC_CLIENT_SECRET)}"
[[ -n "$OIDC_CLIENT_SECRET" ]] || {
  echo "✗ OIDC_CLIENT_SECRET manquant : secret du client Keycloak « pro-learning »." >&2
  exit 1
}

kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -

manifest="$(kubectl -n "$NS" create secret generic "$NAME" \
  --from-literal=DATABASE_URL_PRODUCTION="$DATABASE_URL_PRODUCTION" \
  --from-literal=DATABASE_URL_DEMO="$DATABASE_URL_DEMO" \
  --from-literal=OIDC_CLIENT_SECRET="$OIDC_CLIENT_SECRET" \
  --dry-run=client -o yaml)"

# `apply` plutôt que `create` : le script est rejouable.
printf '%s\n' "$manifest" | kubectl apply -f -
echo "✓ Secret $NS/$NAME à jour."

if command -v kubeseal >/dev/null 2>&1; then
  dir="${SEALED_DIR:-$HOME/sealed-secrets}"
  mkdir -p "$dir"
  printf '%s\n' "$manifest" \
    | kubeseal --controller-namespace kube-system --format yaml > "$dir/$NAME.sealed.yaml"
  echo "✓ Copie scellée : $dir/$NAME.sealed.yaml (hors dépôt)."
else
  echo "ℹ kubeseal absent : pas de copie scellée (facultative)."
fi
