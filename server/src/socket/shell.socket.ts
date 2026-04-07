import { Namespace } from 'socket.io';
import { ChildProcess } from 'child_process';
import { adbService } from '../services/adb.service';
import { isCommandBlocked } from '../utils/command-whitelist';
import { logger } from '../utils/logger';

export function setupShellSocket(nsp: Namespace): void {
  nsp.on('connection', (socket) => {
    logger.info(`Shell socket connected: ${socket.id}`);
    let shellProcess: ChildProcess | null = null;

    socket.on('shell:open', (data: { serial: string }) => {
      if (shellProcess) {
        shellProcess.kill();
      }

      shellProcess = adbService.spawnProcess(data.serial, ['shell']);

      shellProcess.stdout?.on('data', (chunk: Buffer) => {
        socket.emit('shell:output', { data: chunk.toString() });
      });

      shellProcess.stderr?.on('data', (chunk: Buffer) => {
        socket.emit('shell:output', { data: chunk.toString() });
      });

      shellProcess.on('close', () => {
        shellProcess = null;
        socket.emit('shell:close', {});
      });
    });

    socket.on('shell:input', (data: { data: string }) => {
      if (shellProcess?.stdin) {
        shellProcess.stdin.write(data.data);
      }
    });

    socket.on('shell:close', () => {
      if (shellProcess) {
        shellProcess.kill();
        shellProcess = null;
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Shell socket disconnected: ${socket.id}`);
      if (shellProcess) {
        shellProcess.kill();
        shellProcess = null;
      }
    });
  });
}
