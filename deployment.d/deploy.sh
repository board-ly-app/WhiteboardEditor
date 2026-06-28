#!/bin/bash -ve

# === deploy.sh ================================================================
#
# Script to set up deployment in kubernetes using kind.
#
# This deployment script assumes the following:
#   - The .env file is filled out and present in the current working directory
#   - kind is installed on the system
#   - kubectl is installed on the system
#   - The oci images are present on the system
# 
# ==============================================================================

# -- Change working directory to deployment.d
cd "$(dirname "$0")"

# -- Save current environment to tempfile
OLD_ENV_FILE="$(mktemp prev-XXXXX.env)"

cleanup() {
  STATUS="$?"

  [[ -f "${OLD_ENV_FILE}" ]] && shred -u "${OLD_ENV_FILE}"

  exit "${STATUS}"
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

# -- Ensure kind is running
if [[ $(kind get clusters | wc -l) -lt 1 ]]
then
  kind create cluster --config <(envsubst < cluster-config.yml)

  # -- Install gateway provider
  kubectl apply --server-side \
    -f <(kubectl kustomize "https://github.com/nginx/nginx-gateway-fabric/config/crd/gateway-api/experimental?ref=v2.6.5")

  helm install ngf oci://ghcr.io/nginx/charts/nginx-gateway-fabric \
    --create-namespace \
    -n nginx-gateway \
    --set nginxGateway.externalTrafficPolicy=Local \
    --set nginxGateway.gwAPIExperimentalFeatures.enable=true \
    --set nginx.service.type=NodePort \
    --set-json 'nginx.service.nodePorts=[
      {"port":30080,"listenerPort":80},
      {"port":30443,"listenerPort":443},
      {"port":30025,"listenerPort":25},
      {"port":30465,"listenerPort":465},
      {"port":30587,"listenerPort":587},
      {"port":30993,"listenerPort":993}
    ]'

  # -- Install smb csi driver
  helm repo add csi-driver-smb https://raw.githubusercontent.com/kubernetes-csi/csi-driver-smb/master/charts
  helm install csi-driver-smb csi-driver-smb/csi-driver-smb --namespace kube-system --version 1.20.1
fi

# -- Load images
kind load docker-image "${WHITEBOARD_EDITOR_CR_URI}/frontend:${WHITEBOARD_EDITOR_TAG}"
kind load docker-image "${WHITEBOARD_EDITOR_CR_URI}/rest_api:${WHITEBOARD_EDITOR_TAG}"
kind load docker-image "${WHITEBOARD_EDITOR_CR_URI}/web_socket_server:${WHITEBOARD_EDITOR_TAG}"

# -- Set up namespaces
kubectl apply -f <(envsubst < namespaces.yml)

# -- Set up generic secrets
kubectl -n whiteboard-editor create secret generic whiteboard-editor-config --from-env-file ../.env

# -- Set up tls secret for gateway
kubectl -n whiteboard-editor create secret tls cert-default \
  --cert=../.secrets/cert.pem \
  --key=../.secrets/key.pem

# -- Set up tls secrets for pods
kubectl -n whiteboard-editor create secret generic ssl-cert \
  --from-file=../.secrets/cert.pem

kubectl -n whiteboard-editor create secret generic ssl-key \
  --from-file=../.secrets/key.pem

# -- Set up mailserver secrets
kubectl -n whiteboard-editor create secret generic mailserver-config \
  --from-env-file ../.secrets/mailserver.env

kubectl -n whiteboard-editor create secret generic samba-credentials \
  --from-env-file ../.secrets/sambacredentials

# -- Deploy frontend pods
kubectl apply -f <(envsubst < frontend_deployment.yml)

# -- Deploy frontend service
kubectl apply -f <(envsubst < frontend_service.yml)

# -- Deploy rest_api pods
kubectl apply -f <(envsubst < rest_api_deployment.yml)

# -- Deploy rest_api service
kubectl apply -f <(envsubst < rest_api_service.yml)

# -- Deploy web_socket_server pods
kubectl apply -f <(envsubst < web_socket_server_deployment.yml)

# -- Deploy web_socket_server service
kubectl apply -f <(envsubst < web_socket_server_service.yml)

# -- Provision mailserver storage
kubectl apply -f <(envsubst < mailserver_storage.yml)
kubectl apply -f <(envsubst < mailserver_pvcs.yml)

# -- Deploy mailserver pod
kubectl apply -f <(envsubst < mailserver_deployment.yml)

# -- Deploy mailserver service
kubectl apply -f <(envsubst < mailserver_service.yml)

# -- Implement gateway
kubectl apply -f <(envsubst < gateway.yml)
kubectl apply -f <(envsubst < http-routes.yml)
kubectl apply -f <(envsubst < mailserver-routes.yml)
