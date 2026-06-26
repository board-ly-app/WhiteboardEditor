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

- [kubectl](https://kubernetes.io/docs/reference/kubectl/) has been installed.
- [kind](https://kind.sigs.k8s.io/) has been installed.
- All docker images are present locally on the machine (either built or pulled
  from a container registry).
- The .env file in the repository root has been filled out completely, using
  example.env as a template.
- An SSL key and certificate have been created and placed in .secrets/key.pem
  and .secrets/cert.pem, respectively.
- mailserver.env has been filled out and placed at .secrets/mailserver.env,
  using secret_templates.d/mailserver.env as a template.
- A [Samba](https://www.samba.org/) fileserver is either running on or
  accessible from your machine.
    - If you would like to set up a Samba server on your machine, append the
      contents of secret_templates.d/smb.conf to your system smb.conf file
      (likely located at /etc/samba/smb.conf), setting the values of the
      indicated variables, then restart Samba. If you have not yet installed
      Samba, please refer to the relevant instructions for your operating system
      provided [here](https://wiki.samba.org/index.php/Installing_Samba).
- sambacredentials has been filled out and placed at .secrets/sambacredentials,
  using secret_templates.d/sambacredentials as a template.

## Setup and Teardown

Once the prerequisites listed above have been satisfied, simply run deploy.sh.

To update a running cluster, run update.sh.

To tear down the deployment, run teardown.sh.

### Initializing the mailserver

To initialize the mailserver on first deployment, you will need to create an
administrator account. To do so, wait until the mailserver pod is running (you
can check if the pod is running by running
`kubectl -n whiteboard-editor get pods` and waiting until the pod named
whiteboard-editor-mailserver-* is listed with status "Running"). Then, create
the administrator account by running the following command:

```bash
kubectl -n whiteboard-editor exec -it whiteboard-editor-maileserver-* -- setup email add <ADMIN_EMAIL_ADDRESS>
```

You will be prompted to enter a password.

To ensure that the mailserver's ports are accessible, you can test them using
netcat (ncat):

```bash
ncat -vz localhost 25
ncat -vz localhost 465
ncat -vz localhost 587
ncat -vz localhost 993
```

For each command, ncat should exit with status code 0 and indicate that 0 bytes
were sent and 0 bytes were received.

Common problems that may prevent the mailserver from initializing or functioning
properly include:
- Any of the ports 25, 465, 587, or 993 are currently being used another process.
- The Samba fileserver is either not running or inaccessible.
