# CLAUDE.md

## Project Overview

ADB Master — a web interface for managing Android devices via ADB. Monorepo with npm workspaces: `server/` (Express + TypeScript), `client/` (React + Vite + TypeScript), and `relay/` (WebSocket tunnel for remote access).

## Commands

```bash
npm install              # Install all dependencies (root + workspaces)
npm run dev              # Start server (:3000) + client (:5173) concurrently
npm run dev:server       # Server only (tsx watch)
npm run dev:client       # Client only (vite)
npm run dev:relay        # Relay server only (tsx watch, :8080)
npm run build            # Build server + client for production
npm run build:relay      # Build relay for production

# Type checking
npx -w server tsc --noEmit
npx -w client tsc --noEmit
npx -w relay tsc --noEmit

# Client production build
npx -w client vite build

# Relay mode (server connects to remote relay)
RELAY_URL=https://your-vps.com RELAY_PASSWORD=optional npm run dev:server
```

## Architecture

- **Server** (`server/src/`): Express REST API + Socket.IO (3 namespaces: `/devices`, `/logcat`, `/shell`)
  - `services/adb.service.ts` is the single gateway to the `adb` binary — all other services go through it
  - Uses `execFile` (never `exec`) for security
  - Zod validators in `validators/` are applied via `middleware/validate.ts`
  - `middleware/device-guard.ts` checks device serial exists before route handlers
  - `middleware/sanitize.ts` blocks dangerous shell commands
  - Services: `adb`, `device`, `device-info`, `app`, `file`, `screen`, `intent`, `input`, `port`, `settings`, `shell`
  - `relay/relay-client.ts` — connects to relay server for remote access mode

- **Client** (`client/src/`): React 19 + React Router 7 + Zustand state
  - Pages: Devices, Device Info, Apps, Files, Network, Logcat, Terminal, Input, Settings
  - API layer in `api/` uses Axios with dynamic baseURL (local `/api` or remote relay)
  - Socket.IO client in `socket/socket-client.ts` — 3 connections, supports local + remote mode
  - Theming via CSS custom properties in `theme/global.css` (`data-theme` attribute)
  - i18n via i18next — translations in `i18n/en.json` and `i18n/ru.json`
  - `store/connection.store.ts` — local/remote connection mode with localStorage persistence

- **Relay** (`relay/src/`): WebSocket tunnel server for remote access
  - Session management with UUID tokens
  - HTTP request tunneling over WebSocket (JSON + base64 bodies)
  - Agent (server) authenticates with secret, clients authenticate with session ID + optional password
  - Auto-cleanup of expired sessions

## Code Conventions

- TypeScript strict mode everywhere
- Express route params require `as string` cast (Express 5 types return `string | string[]`)
- Server types in `server/src/types/`, mirrored in `client/src/types/`
- API contract defined in `openapi.yaml` at project root
- CSS files co-located with components (e.g., `Button.tsx` + `Button.css`)
- CSS uses `var(--color-*)` tokens — never hardcode colors
- Font: `var(--font-mono)` for data/code, `var(--font-sans)` for UI text
- All user-facing strings go through i18next `t()` function
- Shell inputs are sanitized to prevent injection (reject `;|`$(){}` etc.)

## Key Files

- `server/src/services/adb.service.ts` — ADB execution gateway (security boundary)
- `server/src/utils/command-whitelist.ts` — blocked command patterns
- `server/src/utils/adb-parser.ts` — parse `adb devices` and logcat output
- `server/src/relay/relay-client.ts` — relay tunnel client for remote access
- `client/src/App.tsx` — routing configuration
- `client/src/components/layout/AppShell.tsx` — main layout + device socket listener
- `client/src/store/device.store.ts` — selected device state
- `client/src/store/connection.store.ts` — local/remote connection state
- `relay/src/relay-server.ts` — relay server with session + tunnel logic
- `openapi.yaml` — full API contract
