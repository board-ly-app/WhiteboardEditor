#!/bin/bash -v

# -- Change working directory to deployment.d
cd "$(dirname "$0")"

# -- Save current environment to tempfile
OLD_ENV_FILE="$(mktemp prev-XXXXX.env)"

cleanup() {
  [[ -f "${OLD_ENV_FILE}" ]] && shred -u "${OLD_ENV_FILE}"

  exit 0
}

trap cleanup EXIT

printenv | (grep -e '^WHITEBOARD_EDITOR_' > "${OLD_ENV_FILE}") || true


# -- Source environment variables from .env
set -a
source ../.env

# -- Re-source old environment, to ensure variables defined outside the .env
# file take precedence.
source "${OLD_ENV_FILE}"
shred -u "${OLD_ENV_FILE}"


# -- Delete gateway
kubectl delete -f <(envsubst < http-routes.yml)
kubectl delete -f <(envsubst < gateway.yml)

# -- Delete frontend pods
kubectl delete -f <(envsubst < frontend_deployment.yml)

# -- Delete frontend service
kubectl delete -f <(envsubst < frontend_service.yml)

# -- Delete rest_api pods
kubectl delete -f <(envsubst < rest_api_deployment.yml)

# -- Delete rest_api service
kubectl delete -f <(envsubst < rest_api_service.yml)

# -- Delete web_socket_server pods
kubectl delete -f <(envsubst < web_socket_server_deployment.yml)

# -- Delete web_socket_server service
kubectl delete -f <(envsubst < web_socket_server_service.yml)

# -- Remove secrets
kubectl -n whiteboard-editor delete secret whiteboard-editor-config

# -- Remove namespaces
kubectl delete -f <(envsubst < namespaces.yml)
