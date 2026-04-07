import { Namespace } from 'socket.io';
import { ChildProcess } from 'child_process';
import { logcatService } from '../services/logcat.service';
import { LogcatFilter } from '../types';
import { logger } from '../utils/logger';

export function setupLogcatSocket(nsp: Namespace): void {
  nsp.on('connection', (socket) => {
    logger.info(`Logcat socket connected: ${socket.id}`);
    let currentProcess: ChildProcess | null = null;

    socket.on('logcat:start', (data: { serial: string; filters?: LogcatFilter }) => {
      // Kill existing process if any
      if (currentProcess) {
        currentProcess.kill();
        currentProcess = null;
      }

      const filter = data.filters || {};
      currentProcess = logcatService.startStream(
        data.serial,
        filter,
        (line) => {
          socket.emit('logcat:line', line);
        },
        (error) => {
          socket.emit('logcat:error', { message: error });
        }
      );

      currentProcess.on('close', () => {
        currentProcess = null;
      });
    });

    socket.on('logcat:stop', () => {
      if (currentProcess) {
        currentProcess.kill();
        currentProcess = null;
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Logcat socket disconnected: ${socket.id}`);
      if (currentProcess) {
        currentProcess.kill();
        currentProcess = null;
      }
    });
  });
}
