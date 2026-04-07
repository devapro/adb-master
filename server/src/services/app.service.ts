import { AppInfo, AppType, AppActionResult } from '../types';
import { adbService } from './adb.service';
import { config } from '../config';

class AppService {
  async getApps(serial: string, typeFilter: string = 'all'): Promise<AppInfo[]> {
    const flags = typeFilter === 'system' ? '-s' : typeFilter === 'user' ? '-3' : '';
    const listCmd = `pm list packages -f ${flags}`.trim();
    const result = await adbService.shell(serial, listCmd);

    const packages = result.stdout
      .split('\n')
      .filter((l) => l.startsWith('package:'))
      .map((l) => {
        const match = l.match(/^package:(.+?)=(.+)$/);
        if (!match) return null;
        return { apkPath: match[1], packageName: match[2] };
      })
      .filter((p): p is { apkPath: string; packageName: string } => p !== null);

    const apps: AppInfo[] = [];
    for (const pkg of packages) {
      const info = await this.getAppDetail(serial, pkg.packageName, pkg.apkPath);
      if (info) apps.push(info);
    }

    return apps;
  }

  private async getAppDetail(
    serial: string,
    packageName: string,
    apkPath: string
  ): Promise<AppInfo | null> {
    try {
      const dumpResult = await adbService.shell(serial, `dumpsys package ${packageName}`);
      const dump = dumpResult.stdout;

      const versionName = this.extractField(dump, 'versionName') || '';
      const enabled = !dump.includes('enabled=2') && !dump.includes('enabled=3');

      let appType: AppType = 'user';
      if (apkPath.startsWith('/system/')) {
        appType = 'system';
      } else if (apkPath.startsWith('/product/') || apkPath.startsWith('/vendor/')) {
        appType = 'preinstalled';
      }

      const appName = await this.getAppLabel(serial, packageName);

      const sizes = await this.getAppSize(serial, packageName);

      return {
        packageName,
        appName: appName || packageName,
        versionName,
        type: appType,
        sizeBytes: sizes.total,
        dataSizeBytes: sizes.data,
        cacheSizeBytes: sizes.cache,
        iconBase64: null,
        enabled,
      };
    } catch {
      return {
        packageName,
        appName: packageName,
        versionName: '',
        type: 'user',
        sizeBytes: 0,
        dataSizeBytes: 0,
        cacheSizeBytes: 0,
        iconBase64: null,
        enabled: true,
      };
    }
  }

  private async getAppLabel(serial: string, packageName: string): Promise<string | null> {
    try {
      const result = await adbService.shell(
        serial,
        `cmd package resolve-activity --brief ${packageName} | tail -1`
      );
      const label = result.stdout.trim();
      if (label && !label.includes('/')) return label;

      const dumpResult = await adbService.shell(
        serial,
        `dumpsys package ${packageName} | grep -A1 "non-localized-label"`
      );
      const match = dumpResult.stdout.match(/non-localized-label:(.+)/);
      if (match) return match[1].trim();

      return null;
    } catch {
      return null;
    }
  }

  private async getAppSize(
    serial: string,
    packageName: string
  ): Promise<{ total: number; data: number; cache: number }> {
    try {
      const result = await adbService.shell(serial, `pm path ${packageName}`);
      const apkPath = result.stdout.replace('package:', '').trim();

      const sizeResult = await adbService.shell(serial, `stat -c %s "${apkPath}" 2>/dev/null || echo 0`);
      const total = parseInt(sizeResult.stdout.trim(), 10) || 0;

      const dataResult = await adbService.shell(
        serial,
        `du -s /data/data/${packageName} 2>/dev/null | cut -f1`
      );
      const data = (parseInt(dataResult.stdout.trim(), 10) || 0) * 1024;

      const cacheResult = await adbService.shell(
        serial,
        `du -s /data/data/${packageName}/cache 2>/dev/null | cut -f1`
      );
      const cache = (parseInt(cacheResult.stdout.trim(), 10) || 0) * 1024;

      return { total, data, cache };
    } catch {
      return { total: 0, data: 0, cache: 0 };
    }
  }

  private extractField(dump: string, field: string): string | null {
    const regex = new RegExp(`${field}=([^\\s]+)`);
    const match = dump.match(regex);
    return match ? match[1] : null;
  }

  async installApp(serial: string, apkPath: string): Promise<AppActionResult> {
    const result = await adbService.executeForDevice(serial, ['install', '-r', apkPath], config.uploadTimeout);
    const output = result.stdout + result.stderr;
    const success = output.includes('Success');

    return {
      success,
      action: 'install',
      message: success ? 'App installed successfully' : `Installation failed: ${output.trim()}`,
    };
  }

  async uninstallApp(serial: string, packageName: string): Promise<AppActionResult> {
    const result = await adbService.shell(serial, `pm uninstall --user 0 ${packageName}`);
    const success = result.stdout.includes('Success');

    if (!success) {
      return await this.disableApp(serial, packageName);
    }

    return { success: true, action: 'uninstall', message: 'App uninstalled successfully' };
  }

  async disableApp(serial: string, packageName: string): Promise<AppActionResult> {
    const result = await adbService.shell(serial, `pm disable-user --user 0 ${packageName}`);
    const success =
      result.stdout.includes('disabled') || result.stdout.includes('new state: disabled');

    return {
      success,
      action: 'disable',
      message: success ? 'App disabled successfully' : `Failed to disable: ${result.stderr || result.stdout}`,
    };
  }

  async stopApp(serial: string, packageName: string): Promise<AppActionResult> {
    const result = await adbService.shell(serial, `am force-stop ${packageName}`);
    return {
      success: result.exitCode === 0,
      action: 'force-stop',
      message: result.exitCode === 0 ? 'App stopped successfully' : `Failed: ${result.stderr}`,
    };
  }
}

export const appService = new AppService();
