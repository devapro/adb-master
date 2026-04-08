import { ChildProcess } from 'child_process';
import { LogcatFilter, LogcatLine } from '../types';
import { adbService } from './adb.service';
import { parseLogcatLine } from '../utils/adb-parser';
import { config } from '../config';

const PID_RESOLVE_INTERVAL = 5000;

class LogcatService {
  private async resolvePids(serial: string, packageName: string): Promise<Set<number>> {
    try {
      const result = await adbService.shell(serial, `pidof ${packageName}`);
      const pids = result.stdout
        .trim()
        .split(/\s+/)
        .map((s) => parseInt(s, 10))
        .filter((n) => !isNaN(n));
      return new Set(pids);
    } catch {
      return new Set();
    }
  }

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
    let allowedPids: Set<number> | null = null;
    let pidTimer: ReturnType<typeof setInterval> | null = null;
    const filterByPid = !!filter.packageName;

    if (filter.packageName) {
      // Start with empty set to block all lines until first resolve
      allowedPids = new Set();
      this.resolvePids(serial, filter.packageName).then((pids) => {
        allowedPids = pids;
      });
      pidTimer = setInterval(() => {
        this.resolvePids(serial, filter.packageName!).then((pids) => {
          allowedPids = pids;
        });
      }, PID_RESOLVE_INTERVAL);
    }

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
          if (filterByPid && (!allowedPids || !allowedPids.has(parsed.pid))) {
            continue;
          }
          onLine(parsed);
        }
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      onError(data.toString());
    });

    proc.on('close', () => {
      if (pidTimer) clearInterval(pidTimer);
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
