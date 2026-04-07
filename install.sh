#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/devapro/adb-master.git"
INSTALL_DIR="adb-master"
NODE_MIN_MAJOR=18

# ── colours ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[info]${RESET} $*"; }
success() { echo -e "${GREEN}[ok]${RESET}  $*"; }
warn()    { echo -e "${YELLOW}[warn]${RESET} $*"; }
die()     { echo -e "${RED}[error]${RESET} $*" >&2; exit 1; }

# ── detect OS ──────────────────────────────────────────────────────────────
case "$(uname -s)" in
  Darwin) OS=mac ;;
  Linux)  OS=linux ;;
  *)      die "Unsupported OS: $(uname -s)" ;;
esac
info "Detected OS: ${OS}"

# ── helpers ────────────────────────────────────────────────────────────────
have() { command -v "$1" &>/dev/null; }

install_brew() {
  if ! have brew; then
    info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # add brew to PATH for the rest of this script
    if [[ -x /opt/homebrew/bin/brew ]]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [[ -x /usr/local/bin/brew ]]; then
      eval "$(/usr/local/bin/brew shellenv)"
    fi
  fi
}

# ── install git ────────────────────────────────────────────────────────────
if have git; then
  success "git already installed: $(git --version)"
else
  info "Installing git..."
  if [[ "$OS" == "mac" ]]; then
    install_brew
    brew install git
  else
    if have apt-get; then
      sudo apt-get update -qq && sudo apt-get install -y git
    elif have dnf; then
      sudo dnf install -y git
    elif have yum; then
      sudo yum install -y git
    elif have pacman; then
      sudo pacman -Sy --noconfirm git
    else
      die "Cannot install git: no supported package manager found (apt/dnf/yum/pacman)"
    fi
  fi
  success "git installed: $(git --version)"
fi

# ── install Node.js ────────────────────────────────────────────────────────
need_node=true
if have node; then
  current_major=$(node -e 'process.stdout.write(process.versions.node.split(".")[0])')
  if (( current_major >= NODE_MIN_MAJOR )); then
    success "Node.js already installed: $(node --version)"
    need_node=false
  else
    warn "Node.js $(node --version) is too old (need >= v${NODE_MIN_MAJOR}). Installing a newer version..."
  fi
fi

if $need_node; then
  info "Installing Node.js v${NODE_MIN_MAJOR}+..."
  if [[ "$OS" == "mac" ]]; then
    install_brew
    brew install node
  else
    # Use NodeSource for a pinned LTS version on Linux
    if have curl; then
      curl -fsSL https://deb.nodesource.com/setup_${NODE_MIN_MAJOR}.x | sudo -E bash - 2>/dev/null || true
    fi
    if have apt-get; then
      sudo apt-get install -y nodejs
    elif have dnf; then
      sudo dnf module install -y nodejs:${NODE_MIN_MAJOR}
    elif have yum; then
      sudo yum install -y nodejs
    elif have pacman; then
      sudo pacman -Sy --noconfirm nodejs npm
    else
      die "Cannot install Node.js: no supported package manager found"
    fi
  fi
  success "Node.js installed: $(node --version)"
fi

success "npm: $(npm --version)"

# ── clone repo ─────────────────────────────────────────────────────────────
if [[ -d "$INSTALL_DIR/.git" ]]; then
  warn "Directory '${INSTALL_DIR}' already exists. Pulling latest changes..."
  git -C "$INSTALL_DIR" pull
else
  info "Cloning ${REPO_URL}..."
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

# ── install dependencies ───────────────────────────────────────────────────
info "Installing npm dependencies..."
npm install --prefix "$INSTALL_DIR"

# ── done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}Installation complete!${RESET}"
echo ""
echo -e "  ${BOLD}cd ${INSTALL_DIR}${RESET}"
echo -e "  ${BOLD}npm run dev${RESET}   — start server (port 3000) + client (port 5173)"
echo ""
echo "  Make sure 'adb' is installed and accessible in your PATH."
echo "  Android SDK platform-tools: https://developer.android.com/tools/releases/platform-tools"
echo ""
