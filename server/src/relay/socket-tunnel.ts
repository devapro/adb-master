import { io, Socket } from 'socket.io-client';
import WebSocket from 'ws';
import { logger } from '../utils/logger';

interface TunnelSocketEvent {
  type: 'socket-event';
  namespace: string;
  socketId: string;
  event: string;
  args: any[];
}

interface TunnelSocketConnect {
  type: 'socket-connect' | 'socket-disconnect';
  namespace: string;
  socketId: string;
}

const NAMESPACES = ['/devices', '/screen', '/logcat', '/shell'];

// Binary-safe encoding for JSON tunnel
function encodeArgs(args: any[]): any[] {
  return args.map((arg) => {
    if (Buffer.isBuffer(arg)) {
      return { __bin: true, data: arg.toString('base64') };
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

/**
 * SocketTunnel bridges Socket.IO events between the relay and the local server.
 *
 * For each remote client socket that connects via the relay, a corresponding
 * local Socket.IO connection is created to the local server. Events flow
 * bidirectionally through the agent's WebSocket tunnel to the relay.
 */
export class SocketTunnel {
  private localPort: number;
  private ws: WebSocket | null = null;
  // Map: "namespace:remoteSocketId" → local Socket.IO connection
  private localSockets = new Map<string, Socket>();

  constructor(localPort: number) {
    this.localPort = localPort;
  }

  attach(ws: WebSocket): void {
    this.ws = ws;
  }

  detach(): void {
    this.ws = null;
    for (const [key, socket] of this.localSockets) {
      socket.disconnect();
    }
    this.localSockets.clear();
  }

  handleConnect(msg: TunnelSocketConnect): void {
    if (msg.type === 'socket-connect') {
      this.createLocalSocket(msg.namespace, msg.socketId);
    } else if (msg.type === 'socket-disconnect') {
      this.destroyLocalSocket(msg.namespace, msg.socketId);
    }
  }

  handleEvent(msg: TunnelSocketEvent): void {
    const key = `${msg.namespace}:${msg.socketId}`;
    const localSocket = this.localSockets.get(key);

    if (!localSocket) {
      logger.warn(`No local socket for ${key}, event: ${msg.event}`);
      return;
    }

    const decodedArgs = decodeArgs(msg.args);
    localSocket.emit(msg.event, ...decodedArgs);
  }

  private createLocalSocket(namespace: string, remoteSocketId: string): void {
    const key = `${namespace}:${remoteSocketId}`;

    if (this.localSockets.has(key)) {
      logger.warn(`Local socket already exists for ${key}`);
      return;
    }

    if (!NAMESPACES.includes(namespace)) {
      logger.warn(`Unknown namespace: ${namespace}`);
      return;
    }

    const socket = io(`http://localhost:${this.localPort}${namespace}`, {
      transports: ['websocket'],
      reconnection: false,
    });

    // Forward all events from local server → relay → remote client
    socket.onAny((event: string, ...args: any[]) => {
      this.sendToRelay({
        type: 'socket-event',
        namespace,
        socketId: remoteSocketId,
        event,
        args: encodeArgs(args),
      });
    });

    socket.on('connect', () => {
      logger.debug(`Socket tunnel: local ${key} connected`);
    });

    socket.on('disconnect', () => {
      logger.debug(`Socket tunnel: local ${key} disconnected`);
    });

    this.localSockets.set(key, socket);
  }

  private destroyLocalSocket(namespace: string, remoteSocketId: string): void {
    const key = `${namespace}:${remoteSocketId}`;
    const socket = this.localSockets.get(key);

    if (socket) {
      socket.disconnect();
      this.localSockets.delete(key);
      logger.debug(`Socket tunnel: destroyed local ${key}`);
    }
  }

  private sendToRelay(msg: TunnelSocketEvent): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
