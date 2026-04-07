import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { config } from '../config';
import { setupDeviceSocket } from './device.socket';
import { setupLogcatSocket } from './logcat.socket';
import { setupShellSocket } from './shell.socket';
import { setupScreenSocket } from './screen.socket';
import { logger } from '../utils/logger';

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST'],
    },
  });

  setupDeviceSocket(io.of('/devices'));
  setupLogcatSocket(io.of('/logcat'));
  setupShellSocket(io.of('/shell'));
  setupScreenSocket(io.of('/screen'));

  logger.info('Socket.IO server initialized with namespaces: /devices, /logcat, /shell, /screen');

  return io;
}
