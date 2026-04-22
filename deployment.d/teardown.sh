#!/bin/bash -v

# -- Source environment variables from .env
set -a
source .env

# -- Delete gateway
kubectl delete -f <(envsubst < deployment.d/http-routes.yml)
kubectl delete -f <(envsubst < deployment.d/gateway.yml)

# -- Delete frontend pods
kubectl delete -f <(envsubst < deployment.d/frontend_deployment.yml)

# -- Delete frontend service
kubectl delete -f <(envsubst < deployment.d/frontend_service.yml)

# -- Delete rest_api pods
kubectl delete -f <(envsubst < deployment.d/rest_api_deployment.yml)

# -- Delete rest_api service
kubectl delete -f <(envsubst < deployment.d/rest_api_service.yml)

# -- Delete web_socket_server pods
kubectl delete -f <(envsubst < deployment.d/web_socket_server_deployment.yml)

# -- Delete web_socket_server service
kubectl delete -f <(envsubst < deployment.d/web_socket_server_service.yml)

# -- Remove secrets
kubectl -n whiteboard-editor delete secret whiteboard-editor-config

# -- Remove namespaces
kubectl delete -f <(envsubst < deployment.d/namespaces.yml)
