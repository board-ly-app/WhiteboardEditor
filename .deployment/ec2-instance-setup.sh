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
