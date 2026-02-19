#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash ops/bootstrap-hetzner-ubuntu2404.sh"
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: bash ops/bootstrap-hetzner-ubuntu2404.sh <ssh-public-key>"
  echo "Example: bash ops/bootstrap-hetzner-ubuntu2404.sh 'ssh-ed25519 AAAAC3... user@pc'"
  exit 1
fi

SSH_PUBLIC_KEY="$1"
DEPLOY_USER="deploy"
DISABLE_ROOT_SSH="${DISABLE_ROOT_SSH:-false}"

apt update
apt upgrade -y
apt install -y ca-certificates curl git ufw fail2ban

if ! id -u "${DEPLOY_USER}" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "${DEPLOY_USER}"
fi

usermod -aG sudo "${DEPLOY_USER}"

cat >"/etc/sudoers.d/${DEPLOY_USER}" <<EOF
${DEPLOY_USER} ALL=(ALL) NOPASSWD:ALL
EOF
chmod 440 "/etc/sudoers.d/${DEPLOY_USER}"

mkdir -p "/home/${DEPLOY_USER}/.ssh"
echo "${SSH_PUBLIC_KEY}" > "/home/${DEPLOY_USER}/.ssh/authorized_keys"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh"
chmod 700 "/home/${DEPLOY_USER}/.ssh"
chmod 600 "/home/${DEPLOY_USER}/.ssh/authorized_keys"

ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable

systemctl enable --now fail2ban

curl -fsSL https://get.docker.com | sh
usermod -aG docker "${DEPLOY_USER}"

if [[ "${DISABLE_ROOT_SSH}" == "true" ]]; then
  cat >/etc/ssh/sshd_config.d/99-hardening.conf <<'CONF'
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
CONF

  systemctl restart ssh
fi

echo "Bootstrap complete. Next:"
echo "1) SSH as deploy user"
echo "2) Install Coolify: curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash"
