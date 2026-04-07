import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config';
import { SessionManager } from './session-manager';
import type { TunnelRequest, TunnelResponse, TunnelMessage } from './types';

export class RelayServer {
  private app = express();
  private server: http.Server;
  private wss: WebSocketServer;
  private sessionManager = new SessionManager();

  constructor() {
    this.app.use(cors({ origin: config.corsOrigin }));
    this.app.use(express.json({ limit: '1mb' }));

    this.setupRoutes();

    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ noServer: true });

    this.server.on('upgrade', (req, socket, head) => {
      this.handleUpgrade(req, socket, head);
    });
  }

  private setupRoutes(): void {
    this.app.post('/relay/sessions', (req, res) => {
      try {
        const { password } = req.body || {};
        const result = this.sessionManager.createSession(password);
        res.status(201).json(result);
      } catch (err: any) {
        res.status(503).json({ error: err.message });
      }
    });

    this.app.delete('/relay/sessions/:sessionId', (req, res) => {
      const sessionId = req.params.sessionId as string;
      const secret = req.headers['x-relay-secret'] as string;

      if (!this.sessionManager.validateAgent(sessionId, secret)) {
        res.status(403).json({ error: 'Invalid session or secret' });
        return;
      }

      this.sessionManager.deleteSession(sessionId);
      res.status(204).end();
    });

    this.app.get('/relay/sessions/:sessionId/status', (req, res) => {
      const sessionId = req.params.sessionId as string;
      const password = req.headers['x-relay-password'] as string | undefined;
      const session = this.sessionManager.getSession(sessionId);

      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      if (!this.sessionManager.validateClient(sessionId, password)) {
        res.status(403).json({ error: 'Invalid password' });
        return;
      }

      res.json({
        active: true,
        agentConnected: session.agentWs !== null && session.agentWs.readyState === WebSocket.OPEN,
      });
    });

    this.app.use((req, res, next) => {
      const sessionId = req.headers['x-relay-session'] as string | undefined;
      if (!sessionId) {
        next();
        return;
      }

      this.handleTunnelRequest(req, res, sessionId);
    });
  }

  private handleUpgrade(req: http.IncomingMessage, socket: any, head: Buffer): void {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const match = url.pathname.match(/^\/relay\/agent\/([^/]+)$/);

    if (!match) {
      socket.destroy();
      return;
    }

    const sessionId = match[1];
    const secret = url.searchParams.get('secret') || '';

    if (!this.sessionManager.validateAgent(sessionId, secret)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.handleAgentConnection(sessionId, ws);
    });
  }

  private handleAgentConnection(sessionId: string, ws: WebSocket): void {
    console.log(`Agent connected for session: ${sessionId}`);
    this.sessionManager.setAgentConnection(sessionId, ws);

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const msg: TunnelMessage = { type: 'ping' };
        ws.send(JSON.stringify(msg));
      }
    }, 30_000);

    ws.on('message', (data) => {
      try {
        const message: TunnelMessage = JSON.parse(data.toString());
        const session = this.sessionManager.getSession(sessionId);
        if (!session) return;

        session.lastActivity = Date.now();

        if (message.type === 'http-response') {
          const pending = session.pendingRequests.get(message.requestId);
          if (pending) {
            clearTimeout(pending.timer);
            session.pendingRequests.delete(message.requestId);
            pending.resolve(message);
          }
        } else if (message.type === 'pong') {
          // keepalive acknowledged
        }
      } catch (err) {
        console.error(`Invalid message from agent (session ${sessionId}):`, err);
      }
    });

    ws.on('close', () => {
      console.log(`Agent disconnected for session: ${sessionId}`);
      clearInterval(pingInterval);
      this.sessionManager.removeAgentConnection(sessionId);
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error for session ${sessionId}:`, err);
      clearInterval(pingInterval);
      this.sessionManager.removeAgentConnection(sessionId);
    });
  }

  private async handleTunnelRequest(
    req: express.Request,
    res: express.Response,
    sessionId: string,
  ): Promise<void> {
    const password = req.headers['x-relay-password'] as string | undefined;

    if (!this.sessionManager.validateClient(sessionId, password)) {
      res.status(403).json({ error: 'Invalid session or password' });
      return;
    }

    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (!session.agentWs || session.agentWs.readyState !== WebSocket.OPEN) {
      res.status(502).json({ error: 'Agent not connected' });
      return;
    }

    const requestId = uuidv4();

    try {
      const bodyBuffer = await this.readRequestBody(req);
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string' && !key.startsWith('x-relay-')) {
          headers[key] = value;
        }
      }

      const tunnelReq: TunnelRequest = {
        type: 'http-request',
        requestId,
        method: req.method,
        path: req.originalUrl,
        headers,
        body: bodyBuffer.length > 0 ? bodyBuffer.toString('base64') : undefined,
      };

      const response = await new Promise<TunnelResponse>((resolve, reject) => {
        const timer = setTimeout(() => {
          session.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }, config.requestTimeout);

        session.pendingRequests.set(requestId, { resolve, reject, timer });
        session.agentWs!.send(JSON.stringify(tunnelReq));
      });

      for (const [key, value] of Object.entries(response.headers || {})) {
        res.setHeader(key, value);
      }

      if (response.body) {
        const bodyBuf = Buffer.from(response.body, 'base64');
        res.status(response.status).send(bodyBuf);
      } else {
        res.status(response.status).end();
      }
    } catch (err: any) {
      if (!res.headersSent) {
        if (err.message === 'Request timeout') {
          res.status(504).json({ error: 'Request timeout' });
        } else if (err.message === 'Agent disconnected') {
          res.status(502).json({ error: 'Agent disconnected' });
        } else {
          res.status(500).json({ error: 'Relay error' });
        }
      }
    }
  }

  private readRequestBody(req: express.Request): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;

      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > config.maxRequestSize) {
          reject(new Error('Request body too large'));
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      req.on('error', reject);
    });
  }

  start(): void {
    this.server.listen(config.port, () => {
      console.log(`Relay server listening on port ${config.port}`);
      console.log(`Session management: POST http://localhost:${config.port}/relay/sessions`);
      console.log(`Agent WebSocket: ws://localhost:${config.port}/relay/agent/:sessionId?secret=...`);
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.sessionManager.destroy();
      this.wss.close(() => {
        this.server.close(() => {
          resolve();
        });
      });
    });
  }
}
