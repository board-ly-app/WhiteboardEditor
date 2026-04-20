#!/bin/bash -v

# -- Source environment variables from .env

# -- Apply configmap
kubectl delete -f <(envsubst < deployment.d/config_map.yml)

# -- Deploy frontend pods
kubectl delete -f <(envsubst < deployment.d/frontend_deployment.yml)

# -- Deploy frontend service
kubectl delete -f <(envsubst < deployment.d/frontend_service.yml)

# -- Deploy rest_api pods
kubectl delete -f <(envsubst < deployment.d/rest_api_deployment.yml)

# -- Deploy rest_api service
kubectl delete -f <(envsubst < deployment.d/rest_api_service.yml)

# -- Deploy web_socket_server pods
kubectl delete -f <(envsubst < deployment.d/web_socket_server_deployment.yml)

# -- Deploy web_socket_server service
kubectl delete -f <(envsubst < deployment.d/web_socket_server_service.yml)

