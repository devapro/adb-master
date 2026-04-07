# ADB Master

Web interface for managing Android devices via ADB. Control your device from a browser — locally or remotely.

## Features

### Device Management
- **Device Info Dashboard** — model, manufacturer, Android version, battery, memory, CPU, screen info
- **Wireless ADB** — connect/disconnect devices over WiFi directly from the UI
- **Multi-device Actions** — select multiple devices, bulk install APK, run commands, reboot
- **Device Reboot** — reboot to system, recovery, or bootloader with confirmation
- **Bugreport Capture** — generate and download full bugreport zip

### App Management
- **Browse Apps** — list installed apps with filters (user, system, preinstalled)
- **Install APK** — upload and install APK files with progress tracking
- **Uninstall / Disable / Force Stop** — manage app lifecycle
- **Launch Apps** — start any app from the browser
- **Clear Data** — wipe app data and cache
- **Extract APK** — pull installed APK from device
- **Permissions Manager** — view, grant, and revoke runtime permissions
- **Backup / Restore** — backup and restore app data via `adb backup`

### File Management
- **Browse Files** — navigate the device filesystem
- **Upload Files** — push files from PC to device with progress
- **Download Files** — pull files from device to PC
- **Large Files Finder** — find and clean up files over 1MB
- **Storage Summary** — visual storage usage breakdown
- **Delete Files** — remove files and directories

### Screen
- **Screenshot Capture** — take screenshots, preview, and download as PNG
- **Screen Recording** — start/stop recording with timer, download as MP4

### Network
- **WiFi Toggle** — enable/disable WiFi
- **Proxy Settings** — set/clear HTTP proxy
- **Port Forwarding** — manage `adb forward` and `adb reverse` mappings

### Input Control
- **Text Input** — type text on the device remotely
- **Tap / Swipe** — send touch events by coordinates
- **Key Events** — send Home, Back, Volume, Power, and other key events

### System
- **Settings Editor** — browse and edit system/secure/global settings
- **Quick Toggles** — disable animations, show taps (useful for testing)
- **Intent Launcher** — send custom intents with action, data, component, extras

### Logs & Shell
- **Logcat Viewer** — real-time log streaming with level/tag/search filters
- **Saved Filter Presets** — save and load logcat filter combinations
- **ADB Shell** — interactive terminal with command history
- **Script Upload** — upload and execute shell scripts

### Remote Access
- **Relay Server** — run on a VPS to bridge remote clients to a local ADB server
- **Remote Mode** — connect to any relay from the browser with a session code
- **Password Protection** — optional password per relay session

## Architecture

```
Client (React + Vite)  ←→  Server (Express + Socket.IO)  ←→  ADB binary
       ↕                           ↕
  Relay (optional, on VPS — enables remote access)
```

Monorepo with npm workspaces: `server/`, `client/`, and `relay/`.

## Prerequisites

- **Node.js** >= 18
- **ADB** installed and on PATH (`adb version` should work)

## Quick Start

```bash
# Install dependencies
npm install

# Start both server and client in dev mode
npm run dev
```

- Server: `http://localhost:3000`
- Client: `http://localhost:5173` (proxies API requests to server)

### Individual commands

```bash
npm run dev:server   # server only
npm run dev:client   # client only
npm run dev:relay    # relay server only (:8080)
npm run build        # production build (server + client)
npm run build:relay  # production build (relay)
```

## Connecting a Device

1. Enable **Developer Options** on Android (Settings > About Phone > tap Build Number 7 times)
2. Enable **USB Debugging** (Settings > Developer Options)
3. Connect via USB cable
4. Accept the debugging prompt on the device

**Wireless:** Use the "Connect WiFi" button on the Devices page, or:
```bash
adb tcpip 5555
adb connect <device-ip>:5555
```

## Remote Access Setup

For remote device management (e.g., helping another user):

```bash
# 1. On VPS — start the relay server
RELAY_PORT=8080 npm run dev:relay

# 2. On PC with device — connect to relay
RELAY_URL=https://your-vps.com RELAY_PASSWORD=optional npm run dev:server
# → Prints a session code to share

# 3. Remote user — open client in browser
#    Click connection indicator in header
#    Enter relay URL + session code → Connect
```

### Docker Deployment

Run the relay in Docker — no Node.js installation required.

**Basic:**

```bash
cd docker && docker compose up -d
```

**With ngrok** (for home servers / Raspberry Pi — no VPS needed):

```bash
cd docker
cp .env.example .env
# Edit .env — set NGROK_AUTHTOKEN (get one at https://dashboard.ngrok.com)
docker compose -f docker-compose.ngrok.yml up -d
```

Get the public ngrok URL:

```bash
curl -s http://localhost:4040/api/tunnels | jq '.tunnels[0].public_url'
```

Works on Raspberry Pi (arm64) out of the box. See [`docker/README.md`](./docker/README.md) for full details.

Environment variables for relay:

| Variable | Default | Description |
|----------|---------|-------------|
| `RELAY_PORT` | `8080` | Relay server port |
| `MAX_SESSIONS` | `50` | Max concurrent sessions |
| `SESSION_TIMEOUT` | `86400000` | Session expiry (ms, default 24h) |
| `RELAY_URL` | — | Relay URL (enables relay mode on server) |
| `RELAY_PASSWORD` | — | Optional session password |

## API

The server API is documented in OpenAPI 3.0 format: [`openapi.yaml`](./openapi.yaml)

Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/devices` | List connected devices |
| POST | `/api/devices/connect` | Connect wireless device |
| GET | `/api/devices/:serial/info` | Device info dashboard |
| GET | `/api/devices/:serial/screen/capture` | Take screenshot |
| POST | `/api/devices/:serial/reboot` | Reboot device |
| GET | `/api/devices/:serial/bugreport` | Capture bugreport |
| GET | `/api/devices/:serial/apps` | List installed apps |
| POST | `/api/devices/:serial/apps/install` | Install APK |
| GET | `/api/devices/:serial/apps/:pkg/permissions` | App permissions |
| GET | `/api/devices/:serial/apps/:pkg/apk` | Extract APK |
| GET | `/api/devices/:serial/files` | Browse files |
| POST | `/api/devices/:serial/files/upload` | Upload file to device |
| GET | `/api/devices/:serial/files/download` | Download file from device |
| GET | `/api/devices/:serial/ports` | List port forwards |
| POST | `/api/devices/:serial/input/text` | Send text input |
| POST | `/api/devices/:serial/input/tap` | Send tap event |
| GET | `/api/devices/:serial/settings/:ns` | List settings |
| PUT | `/api/devices/:serial/settings/:ns` | Update setting |
| POST | `/api/devices/:serial/intent` | Send intent |
| POST | `/api/devices/:serial/shell` | Execute command |

Real-time events via Socket.IO namespaces: `/devices`, `/logcat`, `/shell`.

## Project Structure

```
adb-master/
├── server/src/
│   ├── services/        # ADB command services
│   ├── routes/          # Express route handlers
│   ├── middleware/       # device-guard, validate, sanitize
│   ├── validators/      # Zod request validators
│   ├── relay/           # Relay client for remote mode
│   ├── socket/          # Socket.IO handlers
│   ├── types/           # TypeScript interfaces
│   └── utils/           # Parsers, logger, command whitelist
├── client/src/
│   ├── pages/           # React page components
│   ├── components/      # Shared UI components
│   ├── api/             # Axios API functions
│   ├── socket/          # Socket.IO client connections
│   ├── store/           # Zustand state stores
│   ├── types/           # TypeScript interfaces (mirrors server)
│   └── i18n/            # en.json, ru.json translations
├── relay/src/
│   ├── relay-server.ts  # HTTP + WebSocket relay
│   ├── session-manager.ts
│   └── types.ts         # Tunnel protocol types
├── openapi.yaml         # API contract
└── package.json         # Monorepo root
```

## Security

- All ADB calls use `execFile` (not `exec`) — no shell injection possible
- Device serials validated: `/^[a-zA-Z0-9.:_-]+$/`
- Package names validated: `/^[a-zA-Z][a-zA-Z0-9_.]*$/`
- File paths reject `..` traversal
- Shell inputs sanitized — dangerous characters blocked (`;|`$(){}`)
- Dangerous commands blocked: `reboot`, `format`, `rm -rf /`, `dd`, `mkfs`
- Script uploads: max 64KB, line-by-line validation, 5min timeout
- Relay sessions use UUID tokens with separate agent secrets
- Optional password protection for remote sessions

## Tech Stack

**Server:** Express, Socket.IO, TypeScript, Zod, Winston, Multer

**Client:** React 19, React Router 7, Vite, Axios, Socket.IO Client, Zustand, i18next, xterm.js

**Relay:** Express, ws (WebSocket), UUID

## Localization

UI is fully localized in English and Russian. All strings go through i18next.

To add a language:
1. Create `client/src/i18n/<lang>.json` (copy `en.json` as template)
2. Register it in `client/src/i18n/index.ts`
3. Add option to language selector in `Header.tsx`

## License

ISC
