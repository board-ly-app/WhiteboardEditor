# Kubernetes Deployment

This directory contains the configuration files necessary to deploy the app on a
Kubernetes cluster, as part of a CI/CD workflow.

In order to simulate a full Kubernetes deployment, the deployment script
provided, deploy.sh, makes use of kind (Kubernetes in Docker), together with
cloud-provider-kind. A full, multi-host deployment can easily be accomplished by
removing the portions of deploy.sh which make use of kind and configuring
kubectl to use a service such as EKS.

## Prerequisites

Before running deploy.sh, the following conditions should be true:

- [kubectl](https://kubernetes.io/docs/reference/kubectl/) has been installed
- [kind](https://kind.sigs.k8s.io/) has been installed
- A kind cluster has been created
- [cloud-provider-kind](https://github.com/kubernetes-sigs/cloud-provider-kind) has been installed
- All docker images are present locally on the machine (either built or pulled)
- The .env file in the repository root has been filled out completely

## Setup and Teardown

Once the prerequisites listed above have been satisfied, simply run deploy.sh.

To tear down the deployment, simply run teardown.sh.
