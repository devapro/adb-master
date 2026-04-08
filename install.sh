#!/usr/bin/env bash
# install.sh — installs ADB Master without git or Homebrew
# Requirements: curl, tar (standard on macOS and any Linux distro)
set -euo pipefail

REPO_ARCHIVE="https://github.com/devapro/adb-master/archive/refs/heads/main.tar.gz"
INSTALL_DIR="adb-master"
NODE_LTS_MAJOR=22

# ── colours ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[info]${RESET} $*"; }
success() { echo -e "${GREEN}[ok]${RESET}  $*"; }
warn()    { echo -e "${YELLOW}[warn]${RESET} $*"; }
die()     { echo -e "${RED}[error]${RESET} $*" >&2; exit 1; }
have()    { command -v "$1" &>/dev/null; }

ask() {
  local prompt="$1" varname="$2" default="${3:-}"
  if [[ -t 0 ]]; then
    read -rp "$prompt" "$varname"
  else
    read -rp "$prompt" "$varname" < /dev/tty || true
  fi
  eval "$varname=\${$varname:-$default}"
}

# ── verify minimal requirements ────────────────────────────────────────────
for cmd in curl tar; do
  have "$cmd" || die "'$cmd' is required but not found (should be available on any standard system)"
done

# ── detect OS + architecture ───────────────────────────────────────────────
case "$(uname -s)" in
  Darwin) NODE_OS=darwin ;;
  Linux)  NODE_OS=linux  ;;
  *)      die "Unsupported OS: $(uname -s). On Windows use WSL or Docker." ;;
esac

case "$(uname -m)" in
  x86_64|amd64)  NODE_ARCH=x64   ;;
  arm64|aarch64) NODE_ARCH=arm64 ;;
  armv7l)        NODE_ARCH=armv7l ;;
  *)             die "Unsupported architecture: $(uname -m)" ;;
esac

info "Platform: ${NODE_OS}/${NODE_ARCH}"

# ── temp dir (auto-cleaned on exit) ───────────────────────────────────────
TEMP=$(mktemp -d)
trap 'rm -rf "$TEMP"' EXIT

# ── find or download Node.js ───────────────────────────────────────────────
NODE_LOCAL="${INSTALL_DIR}/.nodejs"
NODE_BIN=""
NPM_BIN=""

# 1. Try system Node.js
if have node; then
  cur=$(node -e 'process.stdout.write(process.versions.node.split(".")[0])')
  if (( cur >= NODE_LTS_MAJOR )); then
    NODE_BIN="$(command -v node)"
    NPM_BIN="$(command -v npm)"
    success "Using system Node.js: $(node --version)"
  else
    warn "System Node.js $(node --version) is too old (need >= v${NODE_LTS_MAJOR})."
  fi
fi

# 2. Try previously downloaded Node.js
if [[ -z "$NODE_BIN" && -x "${NODE_LOCAL}/bin/node" ]]; then
  cur=$("${NODE_LOCAL}/bin/node" -e 'process.stdout.write(process.versions.node.split(".")[0])')
  if (( cur >= NODE_LTS_MAJOR )); then
    NODE_BIN="${NODE_LOCAL}/bin/node"
    NPM_BIN="${NODE_LOCAL}/bin/npm"
    success "Using previously downloaded Node.js: $("${NODE_BIN}" --version)"
  fi
fi

# 3. Download Node.js binary
if [[ -z "$NODE_BIN" ]]; then
  info "Fetching latest Node.js v${NODE_LTS_MAJOR} LTS..."
  NODE_VER=$(curl -fsSL "https://nodejs.org/dist/latest-v${NODE_LTS_MAJOR}.x/SHASUMS256.txt" \
    | grep -oE "node-v[0-9.]+-${NODE_OS}-${NODE_ARCH}\.tar\.gz" \
    | head -1 \
    | grep -oE 'v[0-9.]+')
  [[ -z "$NODE_VER" ]] && die "Could not resolve Node.js v${NODE_LTS_MAJOR} version."

  NODE_FILE="node-${NODE_VER}-${NODE_OS}-${NODE_ARCH}.tar.gz"
  NODE_URL="https://nodejs.org/dist/${NODE_VER}/${NODE_FILE}"

  info "Downloading Node.js ${NODE_VER}..."
  curl -fSL --progress-bar -o "${TEMP}/${NODE_FILE}" "$NODE_URL"

  info "Extracting Node.js..."
  tar -xzf "${TEMP}/${NODE_FILE}" -C "$TEMP"
  # stage for moving after project is extracted (so INSTALL_DIR exists)
  DOWNLOADED_NODE="${TEMP}/node-${NODE_VER}-${NODE_OS}-${NODE_ARCH}"
  success "Node.js ${NODE_VER} ready"
fi

# ── download project ────────────────────────────────────────────────────────
if [[ -f "${INSTALL_DIR}/package.json" ]]; then
  warn "Directory '${INSTALL_DIR}' already exists — skipping download."
else
  info "Downloading ADB Master..."
  curl -fSL --progress-bar -o "${TEMP}/adb-master.tar.gz" "$REPO_ARCHIVE"

  info "Extracting project..."
  tar -xzf "${TEMP}/adb-master.tar.gz" -C "$TEMP"

  # GitHub archives extract as "<repo>-<branch>/"
  EXTRACTED=$(find "$TEMP" -maxdepth 1 -type d -name "adb-master-*" | head -1)
  [[ -z "$EXTRACTED" ]] && die "Unexpected archive structure — cannot find extracted project folder."
  mv "$EXTRACTED" "$INSTALL_DIR"
  success "Project downloaded to '${INSTALL_DIR}/'"
fi

# ── move downloaded Node.js into project dir ───────────────────────────────
if [[ -n "${DOWNLOADED_NODE:-}" ]]; then
  mkdir -p "$NODE_LOCAL"
  cp -r "${DOWNLOADED_NODE}/." "$NODE_LOCAL/"
  NODE_BIN="${NODE_LOCAL}/bin/node"
  NPM_BIN="${NODE_LOCAL}/bin/npm"
  success "Node.js installed to '${NODE_LOCAL}/'"
fi

# ── install ADB ────────────────────────────────────────────────────────────
if have adb; then
  success "adb already installed: $(adb version | head -1)"
else
  warn "adb not found."
  ADB_SCRIPT="${INSTALL_DIR}/install-adb.sh"
  if [[ -f "$ADB_SCRIPT" ]]; then
    ask "$(echo -e "${CYAN}[info]${RESET} Install ADB now? [Y/n] ")" answer "y"
    if [[ "${answer}" =~ ^[Yy]$ ]]; then
      bash "$ADB_SCRIPT"
    else
      warn "Skipping ADB install. You will need 'adb' in your PATH to use ADB Master."
    fi
  else
    warn "Install Android platform-tools manually: https://developer.android.com/tools/releases/platform-tools"
  fi
fi

# ── install npm dependencies + build ──────────────────────────────────────
info "Installing npm dependencies..."
(cd "$INSTALL_DIR" && "$NPM_BIN" install)

info "Building ADB Master..."
(cd "$INSTALL_DIR" && "$NPM_BIN" run build)

# ── create launcher script if using local Node.js ─────────────────────────
LAUNCHER="${INSTALL_DIR}/start.sh"
if [[ "$NODE_BIN" == "${NODE_LOCAL}/bin/node" ]]; then
  cat > "$LAUNCHER" << 'LAUNCHER_EOF'
#!/usr/bin/env bash
# Starts ADB Master using the bundled Node.js installation
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="${DIR}/.nodejs/bin:${PATH}"
exec npm start
LAUNCHER_EOF
  chmod +x "$LAUNCHER"

  DEV_LAUNCHER="${INSTALL_DIR}/dev.sh"
  cat > "$DEV_LAUNCHER" << 'LAUNCHER_EOF'
#!/usr/bin/env bash
# Starts ADB Master in development mode using the bundled Node.js installation
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="${DIR}/.nodejs/bin:${PATH}"
exec npm run dev
LAUNCHER_EOF
  chmod +x "$DEV_LAUNCHER"
fi

# ── done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}Installation complete!${RESET}"
echo ""
echo -e "  ${BOLD}cd ${INSTALL_DIR}${RESET}"
if [[ -f "$LAUNCHER" ]]; then
  echo -e "  ${BOLD}./start.sh${RESET}     — production mode  (http://localhost:3000)"
  echo -e "  ${BOLD}./dev.sh${RESET}       — development mode (server :3000 + client :5173)"
  echo ""
  echo -e "  Or add the bundled Node.js to your PATH permanently:"
  echo -e "  ${BOLD}export PATH=\"\$HOME/$(realpath --relative-to="$HOME" "${INSTALL_DIR}" 2>/dev/null || echo "${INSTALL_DIR}")/.nodejs/bin:\$PATH\"${RESET}"
else
  echo -e "  ${BOLD}npm start${RESET}      — production mode  (http://localhost:3000)"
  echo -e "  ${BOLD}npm run dev${RESET}    — development mode (server :3000 + client :5173)"
fi
echo ""
