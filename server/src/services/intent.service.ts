import { IntentParams, IntentResult } from '../types';
import { adbService } from './adb.service';

const EXTRA_TYPE_FLAG: Record<string, string> = {
  string: '--es',
  int: '--ei',
  bool: '--ez',
  float: '--ef',
  long: '--el',
};

class IntentService {
  async sendIntent(serial: string, params: IntentParams): Promise<IntentResult> {
    const parts: string[] = ['am', 'start'];

    if (params.action) parts.push('-a', params.action);
    if (params.data) parts.push('-d', params.data);
    if (params.component) parts.push('-n', params.component);
    if (params.category) parts.push('-c', params.category);

    if (params.extras) {
      for (const extra of params.extras) {
        const flag = EXTRA_TYPE_FLAG[extra.type];
        if (flag) parts.push(flag, extra.key, extra.value);
      }
    }

    if (params.flags) parts.push(params.flags);

    const command = parts.join(' ');
    const result = await adbService.shell(serial, command);
    const output = (result.stdout + result.stderr).trim();
    const success = result.exitCode === 0 && !output.toLowerCase().includes('error');

    return { success, output };
  }
}

export const intentService = new IntentService();
