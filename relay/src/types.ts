import type { WebSocket } from 'ws';
import type { Socket as IOSocket } from 'socket.io';

export interface TunnelRequest {
  type: 'http-request';
  requestId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string; // base64
}

export interface TunnelResponse {
  type: 'http-response';
  requestId: string;
  status: number;
  headers: Record<string, string>;
  body?: string; // base64
}

export interface TunnelSocketEvent {
  type: 'socket-event';
  namespace: string;
  socketId: string;
  event: string;
  args: any[]; // binary data encoded as { __bin: true, data: "<base64>" }
}

export interface TunnelSocketConnect {
  type: 'socket-connect' | 'socket-disconnect';
  namespace: string;
  socketId: string;
}

export interface TunnelPing {
  type: 'ping' | 'pong';
}

export type TunnelMessage = TunnelRequest | TunnelResponse | TunnelSocketEvent | TunnelSocketConnect | TunnelPing;

export interface Session {
  id: string;
  secret: string;
  password?: string;
  agentWs: WebSocket | null;
  createdAt: number;
  lastActivity: number;
  pendingRequests: Map<string, {
    resolve: (response: TunnelResponse) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>;
  clientSockets: Map<string, IOSocket>; // remoteSocketId → Socket.IO socket
}
