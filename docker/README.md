# Docker Deployment — ADB Master

## Quick Start (Linux with USB devices)

```bash
cd docker
docker compose up -d
```

Open `http://localhost:3000`. Android devices connected via USB will be detected automatically.

## macOS / Windows (Network ADB only)

Docker on macOS/Windows cannot access USB devices. Use network ADB instead:

1. On the Android device: enable **Wireless debugging** (Settings > Developer options)
2. Start the container:

```bash
cd docker
docker compose -f docker-compose.network.yml up -d
```

3. Connect to the device from inside the container:

```bash
docker compose -f docker-compose.network.yml exec app adb connect <device-ip>:5555
```

4. Open `http://localhost:3000`

## Relay Server Only

To deploy just the relay (for remote access tunneling):

```bash
cd docker
docker compose --profile relay up -d relay
```

## ngrok Deployment (Home Server / Raspberry Pi)

ngrok creates a public tunnel to your local relay, so remote users can connect without a VPS.

### 1. Get an ngrok authtoken

Sign up at [ngrok.com](https://ngrok.com) and copy your authtoken from the [dashboard](https://dashboard.ngrok.com/get-started/your-authtoken).

### 2. Configure

```bash
cd docker
cp .env.example .env
```

Edit `.env` and set `NGROK_AUTHTOKEN` to your token.

### 3. Start

```bash
docker compose -f docker-compose.ngrok.yml up -d
```

### 4. Get the public URL

Open the ngrok inspector at `http://localhost:4040`, or:

```bash
curl -s http://localhost:4040/api/tunnels | jq '.tunnels[0].public_url'
```

Share this URL with the remote user.

### 5. Connect

On the PC with the Android device connected:

```bash
RELAY_URL=<ngrok-url> RELAY_PASSWORD=optional npm run dev:server
```

The server prints a session code. The remote user enters the ngrok URL and session code in the browser client to connect.

## Raspberry Pi Notes

The Docker images used (`node:20-alpine`, `ngrok/ngrok:latest`) support `linux/arm64`. On a Raspberry Pi 4/5 running a 64-bit OS, everything works out of the box.

If you encounter architecture issues, add `platform: linux/arm64` to the service definitions in the compose file.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | App port |
| `CORS_ORIGIN` | `*` | Allowed CORS origins |
| `ADB_PATH` | `adb` | Path to adb binary |
| `RELAY_PORT` | `8080` | Relay host port |
| `MAX_SESSIONS` | `50` | Max concurrent relay sessions |
| `SESSION_TIMEOUT` | `86400000` | Session expiry in ms (24h) |
| `NGROK_AUTHTOKEN` | — | ngrok auth token (ngrok compose only) |
