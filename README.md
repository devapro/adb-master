# ADB Master

Web interface for managing Android devices via ADB. Helps regular users resolve device issues through a simple browser-based UI instead of the command line.

## Features

- **Device Management** — list connected devices, auto-detect connect/disconnect, connection instructions
- **App Manager** — list all installed apps (system/user/preinstalled), uninstall, disable, force-stop, view sizes
- **Storage Cleanup** — browse files, find large files, view storage usage, delete files/directories
- **Network Controls** — toggle WiFi, configure HTTP proxy
- **Logcat Viewer** — real-time log streaming with level/tag/text filters, export to `.txt`
- **ADB Terminal** — interactive shell via xterm.js, execute commands, upload and run `.sh` scripts
- **Multi-language** — English and Russian (extensible)
- **Dark/Light Mode** — system-aware theme with manual toggle

## Architecture

```
Client (React + TypeScript + Vite)  <-->  Server (Express + TypeScript)
        |                                        |
   Socket.IO client                         Socket.IO server
   Axios HTTP                               ADB binary (execFile)
   Zustand state                            Zod validation
   i18next                                  3 namespaces: /devices, /logcat, /shell
```

Monorepo with npm workspaces: `server/` and `client/`.

## Prerequisites

- **Node.js** >= 18
- **ADB** installed and on PATH (`adb version` should work)
  - Or run `./install-adb.sh` to install it

## Quick Start

```bash
# Install dependencies
npm install

# Start both server and client in dev mode
npm run dev
```

- Server runs on `http://localhost:3000`
- Client runs on `http://localhost:5173` (proxies API requests to server)

### Individual commands

```bash
npm run dev:server   # server only
npm run dev:client   # client only
npm run build        # production build (server + client)
```

## Connecting a Device

1. Enable **Developer Options** on Android (Settings > About Phone > tap Build Number 7 times)
2. Enable **USB Debugging** (Settings > Developer Options)
3. Connect via USB cable
4. Accept the debugging prompt on the device

**Wireless:** `adb tcpip 5555` then `adb connect <device-ip>:5555`

## API

The server API is documented in OpenAPI 3.0 format: [`openapi.yaml`](./openapi.yaml)

Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/devices` | List connected devices |
| GET | `/api/devices/:serial/apps` | List installed apps |
| DELETE | `/api/devices/:serial/apps/:pkg` | Uninstall app |
| GET | `/api/devices/:serial/files` | Browse files |
| GET | `/api/devices/:serial/files/large` | Find large files |
| GET | `/api/devices/:serial/storage` | Storage summary |
| GET | `/api/devices/:serial/network/wifi` | WiFi status |
| PUT | `/api/devices/:serial/network/proxy` | Set proxy |
| GET | `/api/devices/:serial/logcat/snapshot` | Logcat snapshot |
| POST | `/api/devices/:serial/shell` | Execute command |
| POST | `/api/devices/:serial/shell/script` | Upload & run script |

Real-time events via Socket.IO namespaces: `/devices`, `/logcat`, `/shell`.

## Project Structure

```
adb-master/
├── openapi.yaml              # API contract
├── tsconfig.base.json        # Shared TypeScript config
├── server/
│   └── src/
│       ├── index.ts          # Entry point
│       ├── app.ts            # Express app factory
│       ├── config.ts         # Environment config
│       ├── types/            # TypeScript interfaces
│       ├── routes/           # REST endpoints
│       ├── services/         # Business logic (adb, device, app, file, network, logcat, shell)
│       ├── socket/           # Socket.IO handlers
│       ├── middleware/       # Validation, auth, error handling
│       ├── validators/       # Zod schemas
│       └── utils/            # Parsers, logger, command whitelist
├── client/
│   └── src/
│       ├── App.tsx           # Root with routing
│       ├── main.tsx          # Entry point
│       ├── pages/            # Page components
│       ├── components/       # UI components (layout, common, feature-specific)
│       ├── api/              # Axios API modules
│       ├── socket/           # Socket.IO client
│       ├── store/            # Zustand stores (device, theme, locale)
│       ├── i18n/             # Translation files (en, ru)
│       ├── theme/            # CSS variables, global styles
│       └── types/            # Client-side type definitions
└── install-adb.sh            # ADB installer script
```

## Security

- All ADB calls use `execFile` (not `exec`) — no shell injection possible
- Device serials validated: `/^[a-zA-Z0-9.:_-]+$/`
- Package names validated: `/^[a-zA-Z][a-zA-Z0-9_.]*$/`
- File paths reject `..` traversal
- Dangerous commands blocked: `reboot`, `format`, `rm -rf /`, `dd`, `mkfs`
- Script uploads: max 64KB, line-by-line validation, 5min timeout

## Tech Stack

**Server:** Express, Socket.IO, TypeScript, Zod, Winston, Multer

**Client:** React 19, React Router 7, Vite, Axios, Socket.IO Client, Zustand, i18next, xterm.js, react-virtuoso

## Adding a Language

1. Create `client/src/i18n/<lang>.json` (copy `en.json` as template)
2. Register it in `client/src/i18n/index.ts`
3. Add option to language selector in `client/src/components/layout/Header.tsx`

## Example Script

See [`server/scripts/example-script.sh`](./server/scripts/example-script.sh) for a sample ADB script that collects device info. Upload it via the Terminal page.
