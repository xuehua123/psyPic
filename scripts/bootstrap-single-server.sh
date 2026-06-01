#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
SWAP_SIZE="${SWAP_SIZE:-6G}"
ENABLE_SWAP="${ENABLE_SWAP:-auto}"

log() {
  printf '[bootstrap] %s\n' "$*"
}

fail() {
  printf '[bootstrap] ERROR: %s\n' "$*" >&2
  exit 1
}

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    fail "run this script as root on a fresh Ubuntu server"
  fi
}

install_base_packages() {
  log "installing base packages"
  apt-get update
  apt-get install -y \
    ca-certificates \
    curl \
    debian-archive-keyring \
    debian-keyring \
    fail2ban \
    git \
    gnupg \
    nano \
    ufw \
    unattended-upgrades
}

ensure_deploy_user() {
  if id "$DEPLOY_USER" >/dev/null 2>&1; then
    log "user $DEPLOY_USER already exists"
  else
    log "creating user $DEPLOY_USER"
    adduser --disabled-password --gecos "" "$DEPLOY_USER"
  fi

  usermod -aG sudo "$DEPLOY_USER"
}

configure_firewall() {
  log "configuring ufw"
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
}

configure_swap() {
  if [ "$ENABLE_SWAP" = "0" ] || [ "$ENABLE_SWAP" = "false" ]; then
    log "swap creation skipped"
    return
  fi

  if swapon --show | grep -q '^/swapfile'; then
    log "swapfile already active"
    return
  fi

  if [ "$ENABLE_SWAP" = "auto" ]; then
    local mem_mb
    mem_mb="$(awk '/MemTotal/ {print int($2 / 1024)}' /proc/meminfo)"
    if [ "$mem_mb" -ge 7000 ]; then
      log "memory is ${mem_mb}MB; swap creation skipped in auto mode"
      return
    fi
  fi

  log "creating swapfile $SWAP_SIZE"
  fallocate -l "$SWAP_SIZE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile

  if ! grep -q '^/swapfile ' /etc/fstab; then
    printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
  fi
}

install_docker() {
  if command -v docker >/dev/null 2>&1; then
    log "docker already installed"
  else
    log "installing docker"
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg |
      gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    . /etc/os-release
    printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu %s stable\n' \
      "$(dpkg --print-architecture)" "$VERSION_CODENAME" \
      > /etc/apt/sources.list.d/docker.list

    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi

  usermod -aG docker "$DEPLOY_USER"
}

install_caddy() {
  if command -v caddy >/dev/null 2>&1; then
    log "caddy already installed"
    return
  fi

  log "installing caddy"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' |
    gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
}

main() {
  require_root
  install_base_packages
  ensure_deploy_user
  configure_firewall
  configure_swap
  install_docker
  install_caddy
  dpkg-reconfigure --priority=low unattended-upgrades || true

  log "bootstrap complete"
  log "next: add your SSH key for $DEPLOY_USER if needed, then log in as that user"
}

main "$@"
