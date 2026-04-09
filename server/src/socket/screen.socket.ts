import { Namespace } from 'socket.io';
import sharp from 'sharp';
import { logger } from '../utils/logger';
import { screenService } from '../services/screen.service';
import { inputService } from '../services/input.service';

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

    socket.on('screen:start', (data: { serial: string; fps?: number; quality?: number; scale?: number }) => {
      stopStream();
      const { serial, fps = 1, quality = 70, scale = 100 } = data;
      const intervalMs = Math.max(50, Math.round(1000 / Math.min(fps, 30)));
      streaming = true;

      const captureLoop = async () => {
        if (!streaming) return;
        const start = Date.now();
        try {
          const pngBuffer = await screenService.captureScreenshot(serial);
          if (!streaming) return;

          // PNG→JPEG: typically 5-15x smaller, much faster to transfer & decode
          let pipeline = sharp(pngBuffer);
          if (scale > 0 && scale < 100) {
            const meta = await pipeline.metadata();
            if (meta.width && meta.height) {
              pipeline = pipeline.resize(
                Math.round(meta.width * scale / 100),
                Math.round(meta.height * scale / 100),
              );
            }
          }
          const jpegBuffer = await pipeline
            .jpeg({ quality, chromaSubsampling: '4:2:0' })
            .toBuffer();

          if (streaming) {
            // volatile: drop frame if client buffer is full (prefer latest frame)
            // Binary Buffer sent directly — no base64 overhead
            socket.volatile.emit('screen:frame', jpegBuffer, Date.now());
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

    // Input via socket — lower latency than REST for interactive use
    socket.on('input:tap', async (data: { serial: string; x: number; y: number }) => {
      try {
        await inputService.sendTap(data.serial, data.x, data.y);
      } catch (err: any) {
        socket.emit('input:error', { message: err.message });
      }
    });

    socket.on('input:longtap', async (data: { serial: string; x: number; y: number; duration: number }) => {
      try {
        await inputService.sendLongTap(data.serial, data.x, data.y, data.duration);
      } catch (err: any) {
        socket.emit('input:error', { message: err.message });
      }
    });

    socket.on('input:swipe', async (data: {
      serial: string; x1: number; y1: number;
      x2: number; y2: number; duration?: number;
    }) => {
      try {
        await inputService.sendSwipe(data.serial, data.x1, data.y1, data.x2, data.y2, data.duration);
      } catch (err: any) {
        socket.emit('input:error', { message: err.message });
      }
    });

    socket.on('input:keyevent', async (data: { serial: string; keycode: number }) => {
      try {
        await inputService.sendKeyEvent(data.serial, data.keycode);
      } catch (err: any) {
        socket.emit('input:error', { message: err.message });
      }
    });

    socket.on('input:text', async (data: { serial: string; text: string }) => {
      try {
        await inputService.sendText(data.serial, data.text);
      } catch (err: any) {
        socket.emit('input:error', { message: err.message });
      }
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
