#!/bin/bash
# User data to set up EC2 instance for deployment

# Set up the Docker apt repository, add Docker's official GPG key
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update

# Create Docker group and add Ubuntu user to the Docker group
sudo groupadd docker
sudo usermod -aG docker ubuntu

# Download Docker and associate dependencies
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Create directory for WhiteboardEditor
mkdir -p /home/ubuntu/WhiteboardEditor

# Change ownership to user ubuntu
chmod 700 /home/ubuntu/WhiteboardEditor
chown ubuntu:ubuntu /home/ubuntu/WhiteboardEditor

# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod 755 ./kubectl

# Verify kubectl downloaded binary
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl.sha256"
if ! (echo "$(cat kubectl.sha256)  kubectl" | sha256sum --check)
then
  echo "ERROR: kubectl binary did not pass checksum verification" >&2

  exit 1
fi

sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install kind
# For AMD64 / x86_64
[ $(uname -m) = x86_64 ] && curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.31.0/kind-linux-amd64
# For ARM64
[ $(uname -m) = aarch64 ] && curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.31.0/kind-linux-arm64
chmod 755 ./kind
sudo install ./kind /usr/local/bin/

sudo apt-get install curl gpg apt-transport-https --yes
curl -fsSL 'https://packages.buildkite.com/helm-linux/helm-debian/gpgkey' \
  | gpg --dearmor \
  | sudo tee /usr/share/keyrings/helm.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/helm.gpg] https://packages.buildkite.com/helm-linux/helm-debian/any/ any main" \
  | sudo tee /etc/apt/sources.list.d/helm-stable-debian.list
sudo apt-get update
sudo apt-get install helm
