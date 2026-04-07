import { io, Socket } from 'socket.io-client';
import { useConnectionStore } from '../store/connection.store';

const sockets: Record<string, Socket> = {};
let currentMode: 'local' | 'remote' = useConnectionStore.getState().mode;

function createSocketForMode(namespace: string): Socket {
  const { mode, relayUrl, sessionId, password } = useConnectionStore.getState();

  if (mode === 'remote' && relayUrl) {
    return io(`${relayUrl}${namespace}`, {
      transports: ['polling'], // relay rejects WebSocket upgrades; polling is tunneled via HTTP
      autoConnect: false,
      query: { session: sessionId, password: password || '' },
      extraHeaders: { 'x-relay-session': sessionId },
    });
  }

  return io(`${window.location.origin}${namespace}`, {
    transports: ['websocket', 'polling'],
    autoConnect: false,
  });
}

function getSocket(namespace: string): Socket {
  if (!sockets[namespace]) {
    sockets[namespace] = createSocketForMode(namespace);
  }
  return sockets[namespace];
}

export function reconnectSockets(): void {
  Object.keys(sockets).forEach((ns) => {
    sockets[ns].disconnect();
    delete sockets[ns];
  });
  currentMode = useConnectionStore.getState().mode;
}

export const devicesSocket: Socket = new Proxy({} as Socket, {
  get(_target, prop) {
    const sock = getSocket('/devices');
    const value = (sock as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? (value as Function).bind(sock) : value;
  },
});

export const logcatSocket: Socket = new Proxy({} as Socket, {
  get(_target, prop) {
    const sock = getSocket('/logcat');
    const value = (sock as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? (value as Function).bind(sock) : value;
  },
});

export const shellSocket: Socket = new Proxy({} as Socket, {
  get(_target, prop) {
    const sock = getSocket('/shell');
    const value = (sock as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? (value as Function).bind(sock) : value;
  },
});

export const screenSocket: Socket = new Proxy({} as Socket, {
  get(_target, prop) {
    const sock = getSocket('/screen');
    const value = (sock as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? (value as Function).bind(sock) : value;
  },
});
