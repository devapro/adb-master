import http from 'http';
import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { SocketTunnel } from './socket-tunnel';

// Re-define tunnel types locally to avoid cross-workspace imports
interface TunnelRequest {
  type: 'http-request';
  requestId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string; // base64
}

interface TunnelResponse {
  type: 'http-response';
  requestId: string;
  status: number;
  headers: Record<string, string>;
  body?: string; // base64
}

interface TunnelMessage {
  type: string;
  [key: string]: unknown;
}

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_MS = 3000;

export interface RelaySessionInfo {
  connected: boolean;
  sessionId: string | null;
  relayUrl: string;
  shareUrl: string | null;
  hasPassword: boolean;
}

let activeRelayClient: RelayClient | null = null;

export function getActiveRelayClient(): RelayClient | null {
  return activeRelayClient;
}

export class RelayClient {
  private relayUrl: string;
  private localPort: number;
  private password: string | undefined;
  private sessionId: string | null = null;
  private secret: string | null = null;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopping = false;
  private socketTunnel: SocketTunnel;

  constructor(relayUrl: string, localPort: number, password?: string) {
    this.relayUrl = relayUrl.replace(/\/$/, '');
    this.localPort = localPort;
    this.password = password || undefined;
    this.socketTunnel = new SocketTunnel(localPort);
    activeRelayClient = this;
  }

  getSessionInfo(): RelaySessionInfo {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      sessionId: this.sessionId,
      relayUrl: this.relayUrl,
      shareUrl: this.sessionId ? `${this.relayUrl}/relay/${this.sessionId}/` : null,
      hasPassword: !!this.password,
    };
  }

  async start(): Promise<void> {
    await this.createSession();
    this.connectWebSocket();
  }

  stop(): void {
    this.stopping = true;
    this.socketTunnel.detach();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.sessionId && this.secret) {
      this.deleteSession().catch(() => { /* best effort */ });
    }
  }

  private async createSession(): Promise<void> {
    const url = `${this.relayUrl}/relay/sessions`;
    const payload = this.password ? JSON.stringify({ password: this.password }) : '{}';

    const response = await this.httpPost(url, payload);
    const data = JSON.parse(response);
    this.sessionId = data.sessionId;
    this.secret = data.secret;
    this.reconnectAttempts = 0;

    logger.info('='.repeat(60));
    logger.info('Relay session created successfully');
    logger.info(`Session ID: ${this.sessionId}`);
    logger.info(`Share this URL with remote clients:`);
    logger.info(`  ${this.relayUrl}/relay/${this.sessionId}/`);
    logger.info('='.repeat(60));
  }

  private async deleteSession(): Promise<void> {
    try {
      const url = `${this.relayUrl}/relay/sessions/${this.sessionId}`;
      await this.httpRequest(url, 'DELETE', undefined, {
        'x-session-secret': this.secret!,
      });
      logger.info('Relay session deleted');
    } catch (err) {
      logger.warn(`Failed to delete relay session: ${err}`);
    }
  }

  private connectWebSocket(): void {
    if (this.stopping) return;

    const wsUrl = this.relayUrl
      .replace(/^http:/, 'ws:')
      .replace(/^https:/, 'wss:');
    const wsEndpoint = `${wsUrl}/relay/agent/${this.sessionId}?secret=${this.secret}`;

    // maxPayload must accommodate base64-encoded file uploads (500MB * 4/3 ≈ 700MB)
    this.ws = new WebSocket(wsEndpoint, { maxPayload: 700 * 1024 * 1024 });

    this.ws.on('open', () => {
      logger.info('Connected to relay server via WebSocket');
      this.reconnectAttempts = 0;
      this.socketTunnel.attach(this.ws!);
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(data);
    });

    this.ws.on('close', () => {
      logger.warn('Relay WebSocket closed');
      this.socketTunnel.detach();
      this.scheduleReconnect();
    });

    this.ws.on('error', (err: Error) => {
      logger.error(`Relay WebSocket error: ${err.message}`);
    });
  }

  private handleMessage(data: WebSocket.Data): void {
    let msg: TunnelMessage;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      logger.warn('Received invalid JSON from relay');
      return;
    }

    switch (msg.type) {
      case 'http-request':
        this.handleHttpRequest(msg as unknown as TunnelRequest).catch((err) => {
          logger.error(`Error handling tunnel request: ${err}`);
        });
        break;
      case 'socket-connect':
      case 'socket-disconnect':
        this.socketTunnel.handleConnect(msg as { type: 'socket-connect' | 'socket-disconnect'; namespace: string; socketId: string });
        break;
      case 'socket-event':
        this.socketTunnel.handleEvent(msg as { type: 'socket-event'; namespace: string; socketId: string; event: string; args: any[] });
        break;
      case 'ping':
        this.send({ type: 'pong' });
        break;
      default:
        logger.debug(`Unknown tunnel message type: ${msg.type}`);
    }
  }

  private async handleHttpRequest(req: TunnelRequest): Promise<void> {
    try {
      const result = await this.forwardToLocal(req);
      this.send(result);
    } catch (err) {
      const errorResponse: TunnelResponse = {
        type: 'http-response',
        requestId: req.requestId,
        status: 502,
        headers: { 'content-type': 'text/plain' },
        body: Buffer.from(`Bad Gateway: ${err}`).toString('base64'),
      };
      this.send(errorResponse);
    }
  }

  private forwardToLocal(req: TunnelRequest): Promise<TunnelResponse> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
          headers[key.toLowerCase()] = value;
        }
      }
      // Ensure host points to local server
      headers['host'] = `localhost:${this.localPort}`;

      const bodyBuffer = req.body ? Buffer.from(req.body, 'base64') : undefined;
      if (bodyBuffer) {
        headers['content-length'] = String(bodyBuffer.length);
      }

      const localReq = http.request(
        {
          hostname: 'localhost',
          port: this.localPort,
          path: req.path,
          method: req.method,
          headers,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            const body = Buffer.concat(chunks);
            const responseHeaders: Record<string, string> = {};
            for (const [key, value] of Object.entries(res.headers)) {
              if (value && !HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
                responseHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
              }
            }

            resolve({
              type: 'http-response',
              requestId: req.requestId,
              status: res.statusCode || 500,
              headers: responseHeaders,
              body: body.length > 0 ? body.toString('base64') : undefined,
            });
          });
          res.on('error', reject);
        },
      );

      localReq.on('error', reject);
      // Must be long enough for adb push (large files) and adb shell operations
      localReq.setTimeout(10 * 60 * 1000, () => {
        localReq.destroy(new Error('Local request timeout'));
      });

      if (bodyBuffer) {
        localReq.write(bodyBuffer);
      }
      localReq.end();
    });
  }

  private send(msg: object): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private scheduleReconnect(): void {
    if (this.stopping) return;

    this.reconnectAttempts++;

    if (this.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
      logger.info('Max reconnect attempts reached, re-creating session...');
      this.reconnectAttempts = 0;
      this.reconnectTimer = setTimeout(async () => {
        try {
          await this.createSession();
          this.connectWebSocket();
        } catch (err) {
          logger.error(`Failed to re-create relay session: ${err}`);
          this.scheduleReconnect();
        }
      }, RECONNECT_DELAY_MS);
      return;
    }

    logger.info(`Reconnecting to relay in ${RECONNECT_DELAY_MS / 1000}s (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
    this.reconnectTimer = setTimeout(() => {
      this.connectWebSocket();
    }, RECONNECT_DELAY_MS);
  }

  private httpPost(url: string, body: string): Promise<string> {
    return this.httpRequest(url, 'POST', body, {
      'content-type': 'application/json',
    });
  }

  private httpRequest(
    url: string,
    method: string,
    body?: string,
    extraHeaders?: Record<string, string>,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const isHttps = parsed.protocol === 'https:';
      const transport = isHttps ? require('https') : http;

      const headers: Record<string, string> = { ...extraHeaders };
      if (body) {
        headers['content-length'] = String(Buffer.byteLength(body));
      }

      const req = transport.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || (isHttps ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method,
          headers,
        },
        (res: http.IncomingMessage) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            const responseBody = Buffer.concat(chunks).toString();
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(responseBody);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${responseBody}`));
            }
          });
          res.on('error', reject);
        },
      );

      req.on('error', reject);
      if (body) {
        req.write(body);
      }
      req.end();
    });
  }
}
