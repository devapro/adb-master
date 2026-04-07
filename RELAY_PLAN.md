# Relay Server — Implementation Plan

> **Status: IMPLEMENTED** — All three components (relay, server relay client, client remote mode) are complete.

## Overview

A relay/proxy server that enables remote device management. The ADB server (connected to the Android device) connects outbound to a VPS relay, and remote clients connect to the relay to control the device.

```
[PC B: Browser] ←HTTP/WS→ [VPS: Relay] ←WS Tunnel→ [PC A: Server + Device]
```

## Components

### 1. `relay/` — New npm workspace package

**Dependencies**: express, ws, cors, uuid, http-proxy (or manual forwarding)

**Core files**:
- `relay/src/index.ts` — Entry point, starts HTTP server
- `relay/src/relay-server.ts` — Main relay logic:
  - Manages sessions (Map of sessionId → agent WebSocket connection)
  - `POST /relay/sessions` — Agent registers, gets back a sessionId + secret
  - `WS /relay/agent/:sessionId` — Agent connects persistent WebSocket tunnel (authenticated by secret)
  - All other requests with `x-relay-session` header get tunneled to the matching agent
- `relay/src/tunnel.ts` — Request/response serialization over WebSocket:
  - Serialize HTTP request (method, path, headers, body as base64) → send as JSON over WS
  - Deserialize HTTP response (status, headers, body as base64) → send back to client
  - Each tunneled request gets a unique `requestId` for matching responses
  - Streaming support: for large files, chunk the body in multiple WS frames
- `relay/src/socket-proxy.ts` — Socket.IO proxying:
  - Client Socket.IO connects to relay
  - Relay forwards socket events to agent via the WS tunnel
  - Agent forwards events back through tunnel to relay, relay emits to client
  - Multiplexed by namespace (/devices, /logcat, /shell)
- `relay/src/auth.ts` — Simple auth:
  - Session tokens (UUID) for identifying sessions
  - Session secrets for agent authentication
  - Optional password per session (set by agent, required from client)
- `relay/src/config.ts` — Configuration:
  - port (default 8080)
  - maxSessions
  - sessionTimeout (default 24h)
  - maxRequestSize (default 500MB for APK uploads)
- `relay/src/types.ts` — Shared types for tunnel protocol

**Tunnel Protocol** (JSON over WebSocket):
```typescript
// Request from relay to agent
interface TunnelRequest {
  type: 'http-request';
  requestId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string; // base64 encoded
}

// Response from agent to relay  
interface TunnelResponse {
  type: 'http-response';
  requestId: string;
  status: number;
  headers: Record<string, string>;
  body?: string; // base64 encoded
}

// Socket.IO event forwarding
interface TunnelSocketEvent {
  type: 'socket-event';
  namespace: string;
  event: string;
  args: any[];
  socketId?: string;
}

// Socket.IO connection/disconnection
interface TunnelSocketConnect {
  type: 'socket-connect' | 'socket-disconnect';
  namespace: string;
  socketId: string;
}

// Ping/pong for keepalive
interface TunnelPing {
  type: 'ping' | 'pong';
}
```

### 2. `server/` — Add relay client mode

**New files**:
- `server/src/relay/relay-client.ts` — Connects to relay via WebSocket:
  - On startup in relay mode: POST to relay to create session, then connect WS
  - Receives TunnelRequest messages, converts to local HTTP requests via localhost
  - Sends TunnelResponse back
  - Handles Socket.IO tunnel events: connects to local Socket.IO, forwards events
  - Auto-reconnect on disconnect
  - Prints session code for user to share
- `server/src/relay/tunnel-handler.ts` — Processes tunneled requests:
  - Takes serialized request, makes local HTTP call to Express server
  - Collects response, serializes back
  - Handles streaming responses (file downloads) by chunking

**Modified files**:
- `server/src/config.ts` — Add relayUrl, relaySecret optional config from env/args
- `server/src/index.ts` — If relay mode enabled, start relay client after server starts

**Usage**: `RELAY_URL=wss://your-vps.com RELAY_PASSWORD=optional npm run relay`
Or: add a `relay` script that passes args

### 3. `client/` — Add remote connection mode

**New files**:
- `client/src/components/common/ConnectionModal.tsx` — Modal for entering relay URL + session code
- `client/src/store/connection.store.ts` — Zustand store for connection state:
  - mode: 'local' | 'remote'
  - relayUrl: string
  - sessionId: string
  - password?: string

**Modified files**:
- `client/src/api/axios-client.ts` — Dynamic baseURL:
  - Local mode: `/api` (current, proxied by Vite)
  - Remote mode: `https://<relayUrl>/api` with `x-relay-session` header
- `client/src/socket/socket-client.ts` — Dynamic socket URL:
  - Local mode: current behavior
  - Remote mode: connect to relay URL with session query param
- `client/src/components/layout/AppShell.tsx` or header — Add connection mode toggle/indicator
- `client/src/i18n/en.json` / `ru.json` — Add relay/connection strings

## Implementation Order

1. Create `relay/` package with tunnel protocol types
2. Implement relay server (session management + HTTP tunneling)
3. Implement server relay client (connect + tunnel handler)
4. Add Socket.IO proxying to relay and server
5. Update client for remote mode (axios + socket + UI)
6. Add auth (password protection)
7. Test end-to-end

## Security Considerations

- Relay should run behind TLS (nginx reverse proxy or built-in)
- Session tokens are UUID v4 (unguessable)
- Agent authenticates with a secret received at session creation
- Optional password adds a second factor for client access
- Rate limiting on relay to prevent abuse
- Session timeout / cleanup for abandoned sessions
- Sanitize all tunneled headers (strip internal headers)

## Package.json Scripts

```json
// root package.json
"dev:relay": "npm -w relay run dev"
"build:relay": "npm -w relay run build"

// server package.json  
"relay": "tsx src/index.ts --relay"

// relay/package.json
"dev": "tsx watch src/index.ts"
"build": "tsc"
"start": "node dist/index.ts"
```
