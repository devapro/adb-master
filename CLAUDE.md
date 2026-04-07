# CLAUDE.md

## Project Overview

ADB Master — a web interface for managing Android devices via ADB. Monorepo with npm workspaces: `server/` (Express + TypeScript) and `client/` (React + Vite + TypeScript).

## Commands

```bash
npm install              # Install all dependencies (root + workspaces)
npm run dev              # Start server (:3000) + client (:5173) concurrently
npm run dev:server       # Server only (tsx watch)
npm run dev:client       # Client only (vite)
npm run build            # Build both for production

# Type checking
npx -w server tsc --noEmit
npx -w client tsc --noEmit

# Client production build
npx -w client vite build
```

## Architecture

- **Server** (`server/src/`): Express REST API + Socket.IO (3 namespaces: `/devices`, `/logcat`, `/shell`)
  - `services/adb.service.ts` is the single gateway to the `adb` binary — all other services go through it
  - Uses `execFile` (never `exec`) for security
  - Zod validators in `validators/` are applied via `middleware/validate.ts`
  - `middleware/device-guard.ts` checks device serial exists before route handlers
  - `middleware/sanitize.ts` blocks dangerous shell commands

- **Client** (`client/src/`): React 19 + React Router 7 + Zustand state
  - Pages: Devices, Apps, Files, Network, Logcat, Terminal
  - API layer in `api/` uses Axios with `/api` base URL (Vite proxies to server)
  - Socket.IO client in `socket/socket-client.ts` — 3 singleton connections
  - Theming via CSS custom properties in `theme/global.css` (`data-theme` attribute)
  - i18n via i18next — translations in `i18n/en.json` and `i18n/ru.json`

## Code Conventions

- TypeScript strict mode everywhere
- Express route params require `as string` cast (Express 5 types return `string | string[]`)
- Server types in `server/src/types/`, mirrored in `client/src/types/`
- API contract defined in `openapi.yaml` at project root
- CSS files co-located with components (e.g., `Button.tsx` + `Button.css`)
- CSS uses `var(--color-*)` tokens — never hardcode colors
- Font: `var(--font-mono)` for data/code, `var(--font-sans)` for UI text
- All user-facing strings go through i18next `t()` function

## Key Files

- `server/src/services/adb.service.ts` — ADB execution gateway (security boundary)
- `server/src/utils/command-whitelist.ts` — blocked command patterns
- `server/src/utils/adb-parser.ts` — parse `adb devices` and logcat output
- `client/src/App.tsx` — routing configuration
- `client/src/components/layout/AppShell.tsx` — main layout + device socket listener
- `client/src/store/device.store.ts` — selected device state
- `openapi.yaml` — full API contract
