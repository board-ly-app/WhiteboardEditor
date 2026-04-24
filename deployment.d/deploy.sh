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

# -- Source environment variables from .env
set -a
source ../.env

# -- Ensure kind is running
if [[ $(kind get clusters | wc -l) -lt 1 ]]
then
  kind create cluster --config <(envsubst < cluster-config.yml)

  helm install eg oci://docker.io/envoyproxy/gateway-helm \
    --version v1.3.0 \
    --namespace envoy-gateway-system \
    --create-namespace

  kubectl wait --timeout=5m \
    -n envoy-gateway-system \
    deployment/envoy-gateway \
    --for=condition=Available
fi

# -- Ensure cloud-provider-kind is running
if [[ $(docker container ls | grep -e cloud-provider-kind) -lt 1 ]]
then
  docker pull "registry.k8s.io/cloud-provider-kind/cloud-controller-manager:v0.10.0"

  docker run \
    --name "cloud-provider-kind" \
    --network kind \
    -v /var/run/docker.sock:/var/run/docker.sock \
    --rm -d \
    "registry.k8s.io/cloud-provider-kind/cloud-controller-manager:v0.10.0"
fi

# -- Load images
kind load docker-image "whiteboard_editor/frontend:latest"
kind load docker-image "whiteboard_editor/rest_api:latest"
kind load docker-image "whiteboard_editor/web_socket_server:latest"

# -- Set up namespaces
kubectl apply -f <(envsubst < namespaces.yml)

# -- Set up secrets
kubectl -n whiteboard-editor create secret generic whiteboard-editor-config --from-env-file ../.env

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

# -- Implement gateway
kubectl apply -f <(envsubst < gateway.yml)
kubectl apply -f <(envsubst < http-routes.yml)
