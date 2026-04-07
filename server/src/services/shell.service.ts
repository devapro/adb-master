import { adbService, AdbResult } from './adb.service';
import { isCommandBlocked } from '../utils/command-whitelist';
import { AppError } from '../middleware/error-handler';

class ShellService {
  async executeCommand(serial: string, command: string): Promise<AdbResult> {
    if (isCommandBlocked(command)) {
      throw new AppError(403, 'Command is blocked for safety reasons');
    }

    return adbService.shell(serial, command);
  }

  async executeScript(serial: string, scriptContent: string): Promise<string[]> {
    const lines = scriptContent.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
    const results: string[] = [];

    for (const line of lines) {
      if (isCommandBlocked(line)) {
        results.push(`BLOCKED: ${line}`);
        continue;
      }

      const result = await adbService.shell(serial, line);
      results.push(result.stdout || result.stderr);
    }

    return results;
  }
}

export const shellService = new ShellService();
