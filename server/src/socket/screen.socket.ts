import { Namespace } from 'socket.io';
import sharp from 'sharp';
import { logger } from '../utils/logger';
import { inputService } from '../services/input.service';
import { ScreenStream } from '../services/screen-stream';

export function setupScreenSocket(nsp: Namespace): void {
  nsp.on('connection', (socket) => {
    logger.info(`Screen socket connected: ${socket.id}`);
    let streaming = false;
    let currentStream: ScreenStream | null = null;

    const stopStream = () => {
      streaming = false;
      if (currentStream) {
        currentStream.stop();
        currentStream = null;
      }
    };

    socket.on('screen:start', (data: { serial: string; fps?: number; quality?: number; scale?: number }) => {
      stopStream();
      const { serial, fps = 5, quality = 70, scale = 100 } = data;
      const minInterval = Math.max(33, Math.round(1000 / Math.min(fps, 30)));
      streaming = true;

      const stream = new ScreenStream();
      currentStream = stream;

      let processing = false;
      let latestFrame: Buffer | null = null;
      let lastAcceptTime = 0;

      const processFrame = async () => {
        if (!streaming || !latestFrame) {
          processing = false;
          return;
        }
        processing = true;
        const frame = latestFrame;
        latestFrame = null;

        try {
          let pipeline = sharp(frame);
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
            socket.volatile.emit('screen:frame', jpegBuffer, Date.now());
          }
        } catch (err: any) {
          logger.warn(`Screen frame processing error for ${serial}: ${err.message}`);
        }

        processing = false;

        // If a newer frame arrived while we were processing, handle it now
        if (latestFrame && streaming) {
          processFrame();
        }
      };

      stream.on('frame', (pngBuffer: Buffer) => {
        if (!streaming) return;

        // FPS throttling — drop frames that arrive faster than target
        const now = Date.now();
        if (now - lastAcceptTime < minInterval) return;
        lastAcceptTime = now;

        // Always keep only the latest frame; stale frames are discarded
        latestFrame = pngBuffer;

        if (!processing) {
          processFrame();
        }
      });

      stream.on('close', () => {
        if (streaming) {
          socket.emit('screen:error', { message: 'Screen capture stream ended' });
          stopStream();
        }
      });

      stream.on('error', (err: Error) => {
        if (streaming) {
          socket.emit('screen:error', { message: err.message });
          stopStream();
        }
      });

      stream.start(serial, fps);
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
