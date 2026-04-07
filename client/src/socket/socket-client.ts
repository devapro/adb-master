import { io, Socket } from 'socket.io-client';

const BASE_URL = window.location.origin;

export function createSocket(namespace: string): Socket {
  return io(`${BASE_URL}${namespace}`, {
    transports: ['websocket', 'polling'],
    autoConnect: false,
  });
}

export const devicesSocket = createSocket('/devices');
export const logcatSocket = createSocket('/logcat');
export const shellSocket = createSocket('/shell');
