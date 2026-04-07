import { execFile, ChildProcess, spawn } from 'child_process';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface AdbResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

class AdbService {
  private adbPath: string;
  private timeout: number;

  constructor() {
    this.adbPath = config.adbPath;
    this.timeout = config.commandTimeout;
  }

  async execute(args: string[], timeout?: number): Promise<AdbResult> {
    return new Promise((resolve, reject) => {
      logger.debug(`adb ${args.join(' ')}`);

      execFile(
        this.adbPath,
        args,
        {
          timeout: timeout ?? this.timeout,
          maxBuffer: 10 * 1024 * 1024,
        },
        (error, stdout, stderr) => {
          if (error && error.killed) {
            reject(new Error('ADB command timed out'));
            return;
          }

          resolve({
            stdout: stdout?.toString() || '',
            stderr: stderr?.toString() || '',
            exitCode: (error as any)?.code ?? 0,
          });
        }
      );
    });
  }

  async executeForDevice(serial: string, args: string[], timeout?: number): Promise<AdbResult> {
    return this.execute(['-s', serial, ...args], timeout);
  }

  spawnProcess(serial: string, args: string[]): ChildProcess {
    const fullArgs = ['-s', serial, ...args];
    logger.debug(`adb spawn: ${fullArgs.join(' ')}`);
    return spawn(this.adbPath, fullArgs);
  }

  async shell(serial: string, command: string): Promise<AdbResult> {
    return this.executeForDevice(serial, ['shell', command]);
  }
}

export const adbService = new AdbService();
