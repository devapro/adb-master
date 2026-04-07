import { Setting, SettingsNamespace } from '../types';
import { adbService } from './adb.service';

class SettingsService {
  async listSettings(serial: string, namespace: SettingsNamespace): Promise<Setting[]> {
    const result = await adbService.shell(serial, `settings list ${namespace}`);
    return result.stdout
      .split('\n')
      .filter((line) => line.includes('='))
      .map((line) => {
        const idx = line.indexOf('=');
        return {
          key: line.substring(0, idx).trim(),
          value: line.substring(idx + 1).trim(),
        };
      })
      .filter((s) => s.key.length > 0);
  }

  async getSetting(serial: string, namespace: SettingsNamespace, key: string): Promise<string> {
    const result = await adbService.shell(serial, `settings get ${namespace} ${key}`);
    return result.stdout.trim();
  }

  async putSetting(serial: string, namespace: SettingsNamespace, key: string, value: string): Promise<boolean> {
    const result = await adbService.shell(serial, `settings put ${namespace} ${key} ${value}`);
    return result.exitCode === 0;
  }

  async deleteSetting(serial: string, namespace: SettingsNamespace, key: string): Promise<boolean> {
    const result = await adbService.shell(serial, `settings delete ${namespace} ${key}`);
    return result.exitCode === 0;
  }
}

export const settingsService = new SettingsService();
