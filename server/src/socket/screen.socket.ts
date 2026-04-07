import { Namespace } from 'socket.io';
import { logger } from '../utils/logger';
import { screenService } from '../services/screen.service';

export function setupScreenSocket(nsp: Namespace): void {
  nsp.on('connection', (socket) => {
    logger.info(`Screen socket connected: ${socket.id}`);
    let streaming = false;
    let streamTimer: NodeJS.Timeout | null = null;

    const stopStream = () => {
      streaming = false;
      if (streamTimer) {
        clearTimeout(streamTimer);
        streamTimer = null;
      }
    };

    socket.on('screen:start', (data: { serial: string; fps?: number }) => {
      stopStream();
      const { serial, fps = 1 } = data;
      const intervalMs = Math.max(200, Math.round(1000 / Math.min(fps, 5)));
      streaming = true;

      const captureLoop = async () => {
        if (!streaming) return;
        const start = Date.now();
        try {
          const buffer = await screenService.captureScreenshot(serial);
          if (streaming) {
            socket.emit('screen:frame', {
              data: buffer.toString('base64'),
              timestamp: Date.now(),
            });
          }
        } catch (err: any) {
          logger.warn(`Screen capture error for ${serial}: ${err.message}`);
          if (streaming) {
            socket.emit('screen:error', { message: err.message });
          }
        }
        if (streaming) {
          const delay = Math.max(0, intervalMs - (Date.now() - start));
          streamTimer = setTimeout(captureLoop, delay);
        }
      };

      captureLoop();
    });

    socket.on('screen:stop', () => {
      stopStream();
    });

    socket.on('disconnect', () => {
      logger.info(`Screen socket disconnected: ${socket.id}`);
      stopStream();
    });
  });
}
