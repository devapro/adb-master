import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { config } from '../config';
import { logger } from '../utils/logger';

// PNG file boundaries
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const IEND_MARKER = Buffer.from([
  0x00, 0x00, 0x00, 0x00, // chunk length = 0
  0x49, 0x45, 0x4e, 0x44, // "IEND"
  0xae, 0x42, 0x60, 0x82, // CRC
]);

const MAX_BUFFER_SIZE = 20 * 1024 * 1024; // 20MB safety limit
const ESTIMATED_CAPTURE_MS = 200;

/**
 * Persistent screen-capture stream.
 *
 * Instead of spawning a new `adb exec-out screencap -p` process per frame,
 * this runs a single persistent process with a shell loop. Frames are split
 * from the continuous PNG output by detecting PNG magic / IEND boundaries.
 *
 * Events:
 *  - 'frame' (buffer: Buffer)  — a complete PNG frame
 *  - 'close' (code: number)    — the ADB process exited
 *  - 'error' (err: Error)      — the ADB process failed to start
 */
export class ScreenStream extends EventEmitter {
  private proc: ChildProcess | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private running = false;

  /**
   * @param serial  ADB device serial
   * @param fps     Target FPS — used to insert a device-side sleep between
   *                captures so we don't waste CPU/battery at low frame rates.
   */
  start(serial: string, fps: number = 30): void {
    if (this.running) return;
    this.running = true;
    this.buffer = Buffer.alloc(0);

    // Compute device-side sleep so the loop doesn't run faster than needed.
    // screencap itself takes ~200ms, so we only add extra sleep if the
    // target interval exceeds that.
    const targetInterval = 1000 / fps;
    const sleepSec = Math.max(0, (targetInterval - ESTIMATED_CAPTURE_MS) / 1000);

    const loopBody = sleepSec > 0.05
      ? `screencap -p 2>/dev/null || break; sleep ${sleepSec.toFixed(2)}`
      : `screencap -p 2>/dev/null || break`;

    const shellCmd = `while true; do ${loopBody}; done`;
    const args = ['-s', serial, 'exec-out', 'sh', '-c', shellCmd];

    logger.debug(`Screen stream start: adb ${args.join(' ')}`);
    this.proc = spawn(config.adbPath, args);

    this.proc.stdout?.on('data', (chunk: Buffer) => {
      if (!this.running) return;
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.extractFrames();
    });

    this.proc.stderr?.on('data', (data: Buffer) => {
      logger.warn(`Screen stream stderr: ${data.toString().trim()}`);
    });

    this.proc.on('close', (code) => {
      if (!this.running) return;
      this.running = false;
      this.emit('close', code);
    });

    this.proc.on('error', (err) => {
      if (!this.running) return;
      this.running = false;
      this.emit('error', err);
    });
  }

  stop(): void {
    this.running = false;
    if (this.proc) {
      this.proc.kill('SIGKILL');
      this.proc = null;
    }
    this.buffer = Buffer.alloc(0);
    this.removeAllListeners();
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Walk the accumulated buffer and emit every complete PNG frame.
   *
   * A PNG always starts with the 8-byte magic and ends with the 12-byte
   * IEND chunk (length 0 + "IEND" + fixed CRC). We split on those markers.
   */
  private extractFrames(): void {
    while (true) {
      const pngStart = this.buffer.indexOf(PNG_MAGIC);
      if (pngStart === -1) {
        this.buffer = Buffer.alloc(0);
        return;
      }

      // Discard any garbage before the PNG start
      if (pngStart > 0) {
        this.buffer = this.buffer.subarray(pngStart);
      }

      // Look for IEND marker (skip past the 8-byte magic before searching)
      const iendPos = this.buffer.indexOf(IEND_MARKER, 8);
      if (iendPos === -1) {
        // Incomplete frame — wait for more data
        if (this.buffer.length > MAX_BUFFER_SIZE) {
          logger.warn('Screen stream buffer exceeded 20 MB, resetting');
          this.buffer = Buffer.alloc(0);
        }
        return;
      }

      const frameEnd = iendPos + IEND_MARKER.length;
      // Copy the frame out so it's independent of the mutable buffer
      const frame = Buffer.from(this.buffer.subarray(0, frameEnd));

      this.emit('frame', frame);
      this.buffer = this.buffer.subarray(frameEnd);
    }
  }
}
