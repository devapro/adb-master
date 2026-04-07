import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { logger } from '../utils/logger';
import { adbService } from './adb.service';

const DEVICE_RECORDING_PATH = '/sdcard/adb-master-recording.mp4';

class ScreenService {
  private recordings = new Map<string, ChildProcess>();

  async captureScreenshot(serial: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const args = ['-s', serial, 'exec-out', 'screencap', '-p'];
      logger.debug(`adb ${args.join(' ')}`);

      const proc = spawn(config.adbPath, args);
      const chunks: Buffer[] = [];

      proc.stdout.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      proc.stderr.on('data', (data: Buffer) => {
        logger.warn(`screencap stderr: ${data.toString()}`);
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`screencap exited with code ${code}`));
          return;
        }
        const buffer = Buffer.concat(chunks);
        if (buffer.length === 0) {
          reject(new Error('screencap returned empty output'));
          return;
        }
        resolve(buffer);
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }
  startRecording(serial: string): void {
    if (this.recordings.has(serial)) {
      throw new Error('Recording already in progress');
    }

    const proc = adbService.spawnProcess(serial, ['shell', 'screenrecord', DEVICE_RECORDING_PATH]);

    proc.on('close', () => {
      this.recordings.delete(serial);
    });

    proc.on('error', (err) => {
      logger.warn(`screenrecord error for ${serial}: ${err.message}`);
      this.recordings.delete(serial);
    });

    this.recordings.set(serial, proc);
  }

  async stopRecording(serial: string): Promise<void> {
    const proc = this.recordings.get(serial);
    if (proc) {
      proc.kill('SIGINT');
      this.recordings.delete(serial);
    }

    await adbService.shell(serial, 'pkill -INT screenrecord').catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  async getRecording(serial: string): Promise<string> {
    const localPath = path.join(config.uploadDir, `recording_${serial}_${Date.now()}.mp4`);

    if (!fs.existsSync(config.uploadDir)) {
      fs.mkdirSync(config.uploadDir, { recursive: true });
    }

    const result = await adbService.executeForDevice(
      serial,
      ['pull', DEVICE_RECORDING_PATH, localPath],
      config.uploadTimeout
    );

    if (result.exitCode !== 0) {
      throw new Error(`Failed to pull recording: ${result.stderr}`);
    }

    await adbService.shell(serial, `rm -f ${DEVICE_RECORDING_PATH}`).catch(() => {});

    return localPath;
  }

  isRecording(serial: string): boolean {
    return this.recordings.has(serial);
  }
}

export const screenService = new ScreenService();
