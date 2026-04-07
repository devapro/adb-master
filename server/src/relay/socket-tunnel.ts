import { io, Socket } from 'socket.io-client';
import WebSocket from 'ws';
import { logger } from '../utils/logger';

// Local tunnel types
interface TunnelSocketEvent {
  type: 'socket-event';
  namespace: string;
  event: string;
  args: unknown[];
  socketId?: string;
}

interface TunnelSocketConnect {
  type: 'socket-connect' | 'socket-disconnect';
  namespace: string;
  socketId: string;
}

const NAMESPACES = ['/devices'];
// TODO: Add /logcat and /shell namespace tunneling
// These are more complex due to their stateful, streaming nature.

export class SocketTunnel {
  private localPort: number;
  private ws: WebSocket | null = null;
  private localSockets: Map<string, Socket> = new Map();
  // Maps remote socketId -> local socket for each namespace
  private remoteToLocal: Map<string, Map<string, Socket>> = new Map();

  constructor(localPort: number) {
    this.localPort = localPort;
    for (const ns of NAMESPACES) {
      this.remoteToLocal.set(ns, new Map());
    }
  }

  attach(ws: WebSocket): void {
    this.ws = ws;
    this.connectLocalSockets();
  }

  detach(): void {
    this.ws = null;
    for (const socket of this.localSockets.values()) {
      socket.disconnect();
    }
    this.localSockets.clear();
    for (const map of this.remoteToLocal.values()) {
      map.clear();
    }
  }

  handleConnect(msg: TunnelSocketConnect): void {
    if (msg.type === 'socket-connect') {
      logger.debug(`Remote socket ${msg.socketId} connected to ${msg.namespace}`);
      // The local socket is already connected per-namespace, we just track the remote ID
      const nsMap = this.remoteToLocal.get(msg.namespace);
      const localSocket = this.localSockets.get(msg.namespace);
      if (nsMap && localSocket) {
        nsMap.set(msg.socketId, localSocket);
      }
    } else if (msg.type === 'socket-disconnect') {
      logger.debug(`Remote socket ${msg.socketId} disconnected from ${msg.namespace}`);
      const nsMap = this.remoteToLocal.get(msg.namespace);
      if (nsMap) {
        nsMap.delete(msg.socketId);
      }
    }
  }

  handleEvent(msg: TunnelSocketEvent): void {
    const localSocket = this.localSockets.get(msg.namespace);
    if (localSocket) {
      localSocket.emit(msg.event, ...msg.args);
    } else {
      logger.warn(`No local socket for namespace ${msg.namespace}`);
    }
  }

  private connectLocalSockets(): void {
    for (const ns of NAMESPACES) {
      const socket = io(`http://localhost:${this.localPort}${ns}`, {
        transports: ['websocket'],
        reconnection: true,
      });

      socket.onAny((event: string, ...args: unknown[]) => {
        this.forwardToRelay({
          type: 'socket-event',
          namespace: ns,
          event,
          args,
        });
      });

      socket.on('connect', () => {
        logger.debug(`Socket tunnel: local socket connected to ${ns}`);
      });

      socket.on('disconnect', () => {
        logger.debug(`Socket tunnel: local socket disconnected from ${ns}`);
      });

      this.localSockets.set(ns, socket);
    }
  }

  private forwardToRelay(msg: TunnelSocketEvent): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
