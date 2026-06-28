#!/bin/bash -ve

# -- Redeploy with updates, without needing to tear down running deployment.

# -- Change working directory to deployment.d
cd "$(dirname "$0")"

# -- Need to remove old secrets first
kubectl -n whiteboard-editor delete secret whiteboard-editor-config
kubectl -n whiteboard-editor delete secret cert-default
kubectl -n whiteboard-editor delete secret ssl-cert
kubectl -n whiteboard-editor delete secret ssl-key
kubectl -n whiteboard-editor delete secret mailserver-config
kubectl -n whiteboard-editor delete secret samba-credentials

exec ./deploy.sh
