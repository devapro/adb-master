#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/usr/local/lib/android-platform-tools"
BIN_DIR="/usr/local/bin"

# ── colours ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[info]${RESET} $*"; }
success() { echo -e "${GREEN}[ok]${RESET}  $*"; }
warn()    { echo -e "${YELLOW}[warn]${RESET} $*"; }
die()     { echo -e "${RED}[error]${RESET} $*" >&2; exit 1; }

# ── check if already installed ─────────────────────────────────────────────
if command -v adb &>/dev/null; then
  success "adb is already installed: $(adb version | head -1)"
  read -rp "$(echo -e "${CYAN}[info]${RESET} Reinstall/update? [y/N] ")" answer
  if [[ ! "${answer:-n}" =~ ^[Yy]$ ]]; then
    info "Skipping. Current installation kept."
    exit 0
  fi
fi

# ── detect OS ──────────────────────────────────────────────────────────────
OS="$(uname -s)"
case "$OS" in
  Linux)  PLATFORM_TOOLS_URL="https://dl.google.com/android/repository/platform-tools-latest-linux.zip" ;;
  Darwin) PLATFORM_TOOLS_URL="https://dl.google.com/android/repository/platform-tools-latest-darwin.zip" ;;
  *)      die "Unsupported OS: $OS" ;;
esac

info "Starting ADB installation for $OS"

# ── check dependencies ─────────────────────────────────────────────────────
for cmd in curl unzip; do
  if ! command -v "$cmd" &>/dev/null; then
    die "'$cmd' is required but not installed. Please install it first."
  fi
done

# ── download & extract ─────────────────────────────────────────────────────
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

info "Downloading latest platform-tools..."
curl -fSL -o "$TEMP_DIR/platform-tools.zip" "$PLATFORM_TOOLS_URL"

info "Extracting..."
unzip -q "$TEMP_DIR/platform-tools.zip" -d "$TEMP_DIR"

# ── install full platform-tools directory ──────────────────────────────────
info "Installing to $INSTALL_DIR (requires sudo)..."
sudo rm -rf "$INSTALL_DIR"
sudo mv "$TEMP_DIR/platform-tools" "$INSTALL_DIR"
sudo chmod -R a+rX "$INSTALL_DIR"

# ── symlink key binaries ──────────────────────────────────────────────────
for bin in adb fastboot; do
  sudo ln -sf "$INSTALL_DIR/$bin" "$BIN_DIR/$bin"
done

# ── verify ─────────────────────────────────────────────────────────────────
echo ""
success "Installation complete!"
adb version
