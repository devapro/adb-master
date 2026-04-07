import { ChildProcess } from 'child_process';
import { LogcatFilter, LogcatLine } from '../types';
import { adbService } from './adb.service';
import { parseLogcatLine } from '../utils/adb-parser';
import { config } from '../config';

class LogcatService {
  startStream(
    serial: string,
    filter: LogcatFilter,
    onLine: (line: LogcatLine) => void,
    onError: (error: string) => void
  ): ChildProcess {
    const args = ['logcat', '-v', 'threadtime'];

    if (filter.level) {
      args.push(`*:${filter.level}`);
    }
    if (filter.tag) {
      args.push('-s', `${filter.tag}:*`);
    }

    const proc = adbService.spawnProcess(serial, args);
    let buffer = '';

    proc.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const raw of lines) {
        if (!raw.trim()) continue;
        const parsed = parseLogcatLine(raw);
        if (parsed) {
          if (filter.search && !parsed.message.toLowerCase().includes(filter.search.toLowerCase())) {
            continue;
          }
          onLine(parsed);
        }
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      onError(data.toString());
    });

    return proc;
  }

  async getSnapshot(serial: string, lines: number = 500): Promise<LogcatLine[]> {
    const result = await adbService.executeForDevice(serial, [
      'logcat',
      '-d',
      '-v',
      'threadtime',
      '-t',
      lines.toString(),
    ]);

    return result.stdout
      .split('\n')
      .map((raw) => parseLogcatLine(raw))
      .filter((l): l is LogcatLine => l !== null);
  }

  async clearLogcat(serial: string): Promise<void> {
    await adbService.executeForDevice(serial, ['logcat', '-c']);
  }
}

export const logcatService = new LogcatService();
