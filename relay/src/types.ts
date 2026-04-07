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
  event: string;
  args: any[];
  socketId?: string;
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
  agentWs: import('ws').WebSocket | null;
  createdAt: number;
  lastActivity: number;
  pendingRequests: Map<string, {
    resolve: (response: TunnelResponse) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>;
}
