#!/bin/bash -ve

# -- Source environment variables from .env
set -a
source .env

# -- Ensure kind is running
if [[ $(kind get clusters | wc -l) -lt 1 ]]
then
  kind create cluster
fi

# -- Load images
kind load docker-image "whiteboard_editor/frontend:latest"
kind load docker-image "whiteboard_editor/rest_api:latest"
kind load docker-image "whiteboard_editor/web_socket_server:latest"

# -- Set up namespaces
kubectl apply -f <(envsubst < deployment.d/namespaces.yml)

# -- Apply configmap
kubectl apply -f <(envsubst < deployment.d/config_map.yml)

# -- Deploy frontend pods
kubectl apply -f <(envsubst < deployment.d/frontend_deployment.yml)

# -- Deploy frontend service
kubectl apply -f <(envsubst < deployment.d/frontend_service.yml)

# -- Deploy rest_api pods
kubectl apply -f <(envsubst < deployment.d/rest_api_deployment.yml)

# -- Deploy rest_api service
kubectl apply -f <(envsubst < deployment.d/rest_api_service.yml)

# -- Deploy web_socket_server pods
kubectl apply -f <(envsubst < deployment.d/web_socket_server_deployment.yml)

# -- Deploy web_socket_server service
kubectl apply -f <(envsubst < deployment.d/web_socket_server_service.yml)

# -- Implement gateway
kubectl apply -f <(envsubst < deployment.d/gateway.yml)
kubectl apply -f <(envsubst < deployment.d/http-routes.yml)
