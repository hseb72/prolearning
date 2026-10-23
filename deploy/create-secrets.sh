#!/usr/bin/env bash
# Crée (ou met à jour) le Secret de l'API dans le cluster. Aucun secret n'est
# versionné dans ce dépôt.
#
#   OIDC_CLIENT_SECRET=<secret Keycloak> \
#     [DB_PASSWORD=…] [DEMO_DB_PASSWORD=…] [EVAL_DB_PASSWORD=…] ./deploy/create-secrets.sh
#
# ── Modèle réaligné (chart 1.0.0) ────────────────────────────────────────────
# L'API vit dans `api-prolearning` et joint TROIS bases du PostgreSQL MUTUALISÉ
# CloudNativePG (ns `postgres`, postgres-rw) : production, démonstration,
# évaluation. Les trois rôles/bases ne sont plus provisionnés par le socle ; ils
# sont posés hors-bande (runbook). Les mots de passe des rôles vivent dans CE
# Secret (clés DB_PASSWORD / DEMO_DB_PASSWORD / EVAL_DB_PASSWORD), et les
# DATABASE_URL_* en sont dérivées — les deux doivent coïncider.
#
# Chaque mot de passe absent de la ligne de commande est repris du Secret
# existant, sinon tiré au hasard (plus aucune lecture du socle).
#
# OIDC_CLIENT_SECRET : secret du client Keycloak `pro-learning` (onglet
# Credentials). Obligatoire au premier passage ; ensuite conservé s'il est absent.
#
# Relancer met à jour ; les pods relisent au redémarrage :
#   kubectl -n api-prolearning rollout restart deploy/api
#
# Si `kubeseal` est installé, une copie SCELLÉE est aussi produite, HORS dépôt.
set -euo pipefail

NS=api-prolearning
NAME=prolearning-api-secrets
DB_HOST=postgres-rw.postgres.svc.cluster.local:5432

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

# Mot de passe d'un rôle : fourni, sinon Secret existant, sinon tiré au hasard.
role_password() {
  local given="$1" key="$2" value
  if [[ -n "$given" ]]; then printf '%s' "$given"; return; fi
  value="$(secret_value "$NS" "$NAME" "$key")"
  if [[ -z "$value" ]]; then
    value="$(openssl rand -base64 36 | tr -d '\n/+=' | cut -c1-32)"
    echo "ℹ $key tiré au hasard." >&2
  fi
  printf '%s' "$value"
}

DB_PASSWORD="$(role_password "${DB_PASSWORD:-}" DB_PASSWORD)"
DEMO_DB_PASSWORD="$(role_password "${DEMO_DB_PASSWORD:-}" DEMO_DB_PASSWORD)"
EVAL_DB_PASSWORD="$(role_password "${EVAL_DB_PASSWORD:-}" EVAL_DB_PASSWORD)"

# `sslmode=disable` : le PostgreSQL mutualisé n'offre pas TLS (cloisonnement par
# NetworkPolicies) ; `prefer` ferait exiger TLS au pilote.
DATABASE_URL_PRODUCTION="postgresql://prolearning:$(urlencode "$DB_PASSWORD")@$DB_HOST/prolearning?sslmode=disable"
DATABASE_URL_DEMO="postgresql://prolearning-demo:$(urlencode "$DEMO_DB_PASSWORD")@$DB_HOST/prolearning_demo?sslmode=disable"
DATABASE_URL_EVALUATION="postgresql://prolearning-eval:$(urlencode "$EVAL_DB_PASSWORD")@$DB_HOST/prolearning_eval?sslmode=disable"

OIDC_CLIENT_SECRET="${OIDC_CLIENT_SECRET:-$(secret_value "$NS" "$NAME" OIDC_CLIENT_SECRET)}"
[[ -n "$OIDC_CLIENT_SECRET" ]] || {
  echo "✗ OIDC_CLIENT_SECRET manquant : secret du client Keycloak « pro-learning »." >&2
  exit 1
}

kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -

# Mots de passe BRUTS (lus par le provisionnement hors-bande) ET URLs (lues par l'app).
manifest="$(kubectl -n "$NS" create secret generic "$NAME" \
  --from-literal=DB_PASSWORD="$DB_PASSWORD" \
  --from-literal=DEMO_DB_PASSWORD="$DEMO_DB_PASSWORD" \
  --from-literal=EVAL_DB_PASSWORD="$EVAL_DB_PASSWORD" \
  --from-literal=DATABASE_URL_PRODUCTION="$DATABASE_URL_PRODUCTION" \
  --from-literal=DATABASE_URL_DEMO="$DATABASE_URL_DEMO" \
  --from-literal=DATABASE_URL_EVALUATION="$DATABASE_URL_EVALUATION" \
  --from-literal=OIDC_CLIENT_SECRET="$OIDC_CLIENT_SECRET" \
  --dry-run=client -o yaml)"

printf '%s\n' "$manifest" | kubectl apply -f -
echo "✓ Secret $NS/$NAME à jour."

if command -v kubeseal >/dev/null 2>&1; then
  dir="${SEALED_DIR:-$HOME/sealed-secrets}"
  mkdir -p "$dir"
  printf '%s\n' "$manifest" | kubeseal --controller-namespace kube-system --format yaml > "$dir/$NAME.sealed.yaml"
  echo "✓ Copie scellée : $dir/$NAME.sealed.yaml (hors dépôt)."
else
  echo "ℹ kubeseal absent : pas de copie scellée (facultative)."
fi
