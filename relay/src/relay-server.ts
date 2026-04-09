import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config';
import { SessionManager } from './session-manager';
import type { TunnelRequest, TunnelResponse, TunnelMessage, TunnelSocketEvent, TunnelSocketConnect } from './types';

const SOCKET_NAMESPACES = ['/devices', '/screen', '/logcat', '/shell'];

// Binary-safe encoding: detect Buffers in args and encode as { __bin, data }
function encodeArgs(args: any[]): any[] {
  return args.map((arg) => {
    if (Buffer.isBuffer(arg)) {
      return { __bin: true, data: arg.toString('base64') };
    }
    if (arg instanceof ArrayBuffer) {
      return { __bin: true, data: Buffer.from(new Uint8Array(arg)).toString('base64') };
    }
    if (arg instanceof Uint8Array) {
      return { __bin: true, data: Buffer.from(arg).toString('base64') };
    }
    return arg;
  });
}

function decodeArgs(args: any[]): any[] {
  return args.map((arg) => {
    if (arg && typeof arg === 'object' && arg.__bin && typeof arg.data === 'string') {
      return Buffer.from(arg.data, 'base64');
    }
    return arg;
  });
}

export class RelayServer {
  private app = express();
  private server: http.Server;
  private wss: WebSocketServer;
  private io: SocketIOServer;
  private sessionManager = new SessionManager();

  constructor() {
    this.app.use(cors({ origin: config.corsOrigin }));
    // Parse JSON only for relay's own routes, not tunneled requests.
    // Tunneled requests need the raw body stream intact for readRequestBody().
    const jsonParser = express.json({ limit: '1mb' });
    this.app.use((req, res, next) => {
      if (req.headers['x-relay-session']) {
        next();
      } else {
        jsonParser(req, res, next);
      }
    });

    this.server = http.createServer(this.app);

    // Socket.IO server for client connections (handles /socket.io/ upgrades)
    this.io = new SocketIOServer(this.server, {
      cors: { origin: '*' },
      pingInterval: 25000,
      pingTimeout: 20000,
    });
    this.setupSocketIO();

    // Raw WebSocket for agent connections (noServer — we route upgrades manually)
    // maxPayload must accommodate base64-encoded file uploads (500MB * 4/3 ≈ 700MB)
    this.wss = new WebSocketServer({ noServer: true, maxPayload: 700 * 1024 * 1024 });
    this.server.on('upgrade', (req, socket, head) => {
      this.handleUpgrade(req, socket, head);
    });

    this.setupRoutes();
  }

  // ─── Socket.IO: client ↔ agent event forwarding ───

  private setupSocketIO(): void {
    for (const ns of SOCKET_NAMESPACES) {
      const nsp = this.io.of(ns);

      // Auth middleware: validate session from query params
      nsp.use((socket, next) => {
        const sessionId = socket.handshake.query.session as string;
        const password = (socket.handshake.query.password as string) || undefined;

        if (!sessionId) {
          return next(new Error('Missing session'));
        }

        if (!this.sessionManager.validateClient(sessionId, password)) {
          return next(new Error('Invalid session or password'));
        }

        const session = this.sessionManager.getSession(sessionId);
        if (!session || !session.agentWs || session.agentWs.readyState !== WebSocket.OPEN) {
          return next(new Error('Agent not connected'));
        }

        socket.data.sessionId = sessionId;
        next();
      });

      nsp.on('connection', (socket) => {
        const sessionId = socket.data.sessionId as string;
        const session = this.sessionManager.getSession(sessionId);
        if (!session) { socket.disconnect(); return; }

        // Track this client socket
        session.clientSockets.set(socket.id, socket);

        // Notify agent: new client socket connected
        this.sendToAgent(session.agentWs!, {
          type: 'socket-connect',
          namespace: ns,
          socketId: socket.id,
        });

        // Forward all client events → agent
        socket.onAny((event: string, ...args: any[]) => {
          const currentSession = this.sessionManager.getSession(sessionId);
          if (!currentSession?.agentWs || currentSession.agentWs.readyState !== WebSocket.OPEN) return;

          const msg: TunnelSocketEvent = {
            type: 'socket-event',
            namespace: ns,
            socketId: socket.id,
            event,
            args: encodeArgs(args),
          };
          currentSession.agentWs.send(JSON.stringify(msg));
        });

        socket.on('disconnect', () => {
          const currentSession = this.sessionManager.getSession(sessionId);
          if (currentSession) {
            currentSession.clientSockets.delete(socket.id);

            if (currentSession.agentWs && currentSession.agentWs.readyState === WebSocket.OPEN) {
              this.sendToAgent(currentSession.agentWs, {
                type: 'socket-disconnect',
                namespace: ns,
                socketId: socket.id,
              });
            }
          }
        });
      });
    }
  }

  // Forward agent socket-event → correct client socket
  private handleAgentSocketEvent(sessionId: string, msg: TunnelSocketEvent): void {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) return;

    const clientSocket = session.clientSockets.get(msg.socketId);
    if (!clientSocket) return;

    const decodedArgs = decodeArgs(msg.args);

    // Use volatile for screen frames to drop if client is slow
    if (msg.namespace === '/screen' && msg.event === 'screen:frame') {
      clientSocket.volatile.emit(msg.event, ...decodedArgs);
    } else {
      clientSocket.emit(msg.event, ...decodedArgs);
    }
  }

  // ─── HTTP routes ───

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

    // HTTP tunnel middleware — tunnels REST API calls to agent
    this.app.use((req, res, next) => {
      const sessionId = req.headers['x-relay-session'] as string | undefined;
      if (!sessionId) {
        next();
        return;
      }

      this.handleTunnelRequest(req, res, sessionId);
    });
  }

  // ─── Agent WebSocket (raw WS, not Socket.IO) ───

  private handleUpgrade(req: http.IncomingMessage, socket: any, head: Buffer): void {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const match = url.pathname.match(/^\/relay\/agent\/([^/]+)$/);

    if (!match) {
      // Not an agent upgrade — let Socket.IO handle its own /socket.io/ upgrades
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

        switch (message.type) {
          case 'http-response': {
            const pending = session.pendingRequests.get(message.requestId);
            if (pending) {
              clearTimeout(pending.timer);
              session.pendingRequests.delete(message.requestId);
              pending.resolve(message);
            }
            break;
          }
          case 'socket-event':
            this.handleAgentSocketEvent(sessionId, message as TunnelSocketEvent);
            break;
          case 'pong':
            break;
          default:
            break;
        }
      } catch (err) {
        console.error(`Invalid message from agent (session ${sessionId}):`, err);
      }
    });

    ws.on('close', () => {
      console.log(`Agent disconnected for session: ${sessionId}`);
      clearInterval(pingInterval);
      this.sessionManager.removeAgentConnection(sessionId);

      // Disconnect all client sockets for this session
      const session = this.sessionManager.getSession(sessionId);
      if (session) {
        for (const [, sock] of session.clientSockets) {
          sock.disconnect(true);
        }
        session.clientSockets.clear();
      }
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error for session ${sessionId}:`, err);
      clearInterval(pingInterval);
      this.sessionManager.removeAgentConnection(sessionId);
    });
  }

  private sendToAgent(ws: WebSocket, msg: TunnelMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  // ─── HTTP tunnel ───

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
        // Strip CORS headers — relay's own CORS middleware handles these
        if (!key.toLowerCase().startsWith('access-control-')) {
          res.setHeader(key, value);
        }
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
      console.log(`Socket.IO namespaces: ${SOCKET_NAMESPACES.join(', ')}`);
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.sessionManager.destroy();
      this.io.close();
      this.wss.close(() => {
        this.server.close(() => {
          resolve();
        });
      });
    });
  }
}
