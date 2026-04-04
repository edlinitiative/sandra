#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# Sandra Voice Bridge — Oracle Cloud VM Bootstrap
#
# Run ONCE on a fresh VM as the default user (ubuntu / opc):
#   curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/sandra/main/scripts/vm-setup.sh | bash
#
# Supports: Ubuntu 22.04/24.04 LTS (recommended) and Oracle Linux 8/9
#
# What this script does:
#   1. Installs Docker Engine + Compose plugin
#   2. Opens the required firewall ports (OS-level)
#   3. Clones the Sandra repo into /opt/sandra
#   4. Copies .env.example → .env (you must fill in secrets before step 5)
#   5. Starts the voice-bridge + Caddy stack via Docker Compose
#
# Oracle Cloud Security List rules you must add MANUALLY in the OCI console:
#   Ingress  TCP  0.0.0.0/0   port 22    (SSH — already exists)
#   Ingress  TCP  0.0.0.0/0   port 80    (Caddy ACME challenge)
#   Ingress  TCP  0.0.0.0/0   port 443   (HTTPS)
#   Ingress  UDP  0.0.0.0/0   port 443   (HTTP/3 QUIC)
#   Ingress  UDP  0.0.0.0/0   10000-11000 (WebRTC media from Meta)
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

REPO_URL="https://github.com/edlight-initiative/sandra.git"
DEPLOY_DIR="/opt/sandra"
DOMAIN="voice.edlight.org"

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}==>${NC} $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC} $*"; }
abort() { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }

# ── Detect distro ────────────────────────────────────────────────────────────
if command -v apt-get &>/dev/null; then
  DISTRO="ubuntu"
elif command -v dnf &>/dev/null; then
  DISTRO="oraclelinux"
else
  abort "Unsupported distro — only Ubuntu and Oracle Linux are supported."
fi

info "Detected distro: $DISTRO"

# ── 1. Install Docker ────────────────────────────────────────────────────────
info "Installing Docker..."

if command -v docker &>/dev/null; then
  info "Docker already installed: $(docker --version)"
else
  if [[ "$DISTRO" == "ubuntu" ]]; then
    sudo apt-get update -y
    sudo apt-get install -y ca-certificates curl gnupg lsb-release

    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
      | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
      | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  else
    # Oracle Linux 8/9
    sudo dnf -y install dnf-plugins-core
    sudo dnf config-manager --add-repo \
      https://download.docker.com/linux/centos/docker-ce.repo
    sudo dnf -y install docker-ce docker-ce-cli containerd.io docker-compose-plugin
  fi

  sudo systemctl enable --now docker
  info "Docker installed: $(docker --version)"
fi

# Add current user to docker group (effective after next login / newgrp)
sudo usermod -aG docker "$USER" || true

# ── 2. Open OS-level firewall ports ─────────────────────────────────────────
info "Configuring OS firewall..."

if [[ "$DISTRO" == "ubuntu" ]]; then
  if command -v ufw &>/dev/null; then
    sudo ufw allow 22/tcp    comment 'SSH'    2>/dev/null || true
    sudo ufw allow 80/tcp    comment 'Caddy ACME' 2>/dev/null || true
    sudo ufw allow 443/tcp   comment 'HTTPS'  2>/dev/null || true
    sudo ufw allow 443/udp   comment 'HTTP/3' 2>/dev/null || true
    sudo ufw allow 10000:11000/udp comment 'WebRTC media' 2>/dev/null || true
    sudo ufw --force enable
    info "ufw rules applied"
  else
    warn "ufw not found — skipping OS firewall configuration"
  fi
else
  # Oracle Linux uses firewalld
  if command -v firewall-cmd &>/dev/null; then
    sudo firewall-cmd --permanent --add-port=80/tcp
    sudo firewall-cmd --permanent --add-port=443/tcp
    sudo firewall-cmd --permanent --add-port=443/udp
    sudo firewall-cmd --permanent --add-port=10000-11000/udp
    sudo firewall-cmd --reload
    info "firewalld rules applied"
  else
    warn "firewalld not found — skipping OS firewall configuration"
  fi
fi

# ── 3. Clone the repo ────────────────────────────────────────────────────────
info "Cloning Sandra repo into $DEPLOY_DIR..."

if [[ -d "$DEPLOY_DIR/.git" ]]; then
  info "Repo already cloned — pulling latest..."
  sudo git -C "$DEPLOY_DIR" pull origin main
else
  sudo git clone "$REPO_URL" "$DEPLOY_DIR"
fi

sudo chown -R "$USER:$USER" "$DEPLOY_DIR"

# ── 4. Prepare .env ─────────────────────────────────────────────────────────
ENV_FILE="$DEPLOY_DIR/voice-bridge/.env"

if [[ -f "$ENV_FILE" ]]; then
  warn ".env already exists — skipping copy"
else
  cp "$DEPLOY_DIR/voice-bridge/.env.example" "$ENV_FILE"
  info ".env created from .env.example"
fi

echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  ACTION REQUIRED: fill in your secrets before continuing    ${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Edit: nano $ENV_FILE"
echo ""
echo "  Required values:"
echo "    WHATSAPP_PHONE_NUMBER_ID   (from Meta Developer Console)"
echo "    WHATSAPP_ACCESS_TOKEN      (from Meta Developer Console)"
echo "    OPENAI_API_KEY             (from platform.openai.com)"
echo ""
echo "  Also confirm: DNS A record  $DOMAIN → $(curl -s ifconfig.me 2>/dev/null || echo '<VM_PUBLIC_IP>')"
echo ""

read -r -p "Press ENTER once .env is filled in (Ctrl+C to quit and come back)..."

# ── 5. Start the stack ────────────────────────────────────────────────────────
info "Building and starting sandra-voice-bridge + caddy..."

cd "$DEPLOY_DIR/voice-bridge"

# sg docker ensures the group change is in effect without requiring logout
sg docker -c "docker compose up --build -d"

echo ""
info "Stack started. Checking health..."
sleep 8

if sg docker -c "docker compose ps" | grep -q "healthy\|Up"; then
  echo ""
  echo -e "${GREEN}✓ Voice bridge is running!${NC}"
  echo ""
  echo "  Health:  https://$DOMAIN/health"
  echo "  Webhook: https://$DOMAIN/webhook/calls"
  echo ""
  echo "  Logs:    docker compose logs -f --tail=100"
  echo "  Restart: docker compose restart"
  echo "  Redeploy after git pull: docker compose up --build -d"
else
  warn "Container may not be healthy yet. Check logs:"
  sg docker -c "docker compose logs --tail=50"
fi
