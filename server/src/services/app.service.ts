import fs from 'fs';
import { AppInfo, AppType, AppActionResult, AppPermission } from '../types';
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

    const BATCH = 10;
    const apps: AppInfo[] = [];
    for (let i = 0; i < packages.length; i += BATCH) {
      const batch = packages.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map((pkg) => this.getAppDetail(serial, pkg.packageName, pkg.apkPath))
      );
      apps.push(...results.filter((a): a is AppInfo => a !== null));
    }

    return apps;
  }

  private async getAppDetail(
    serial: string,
    packageName: string,
    apkPath: string
  ): Promise<AppInfo | null> {
    try {
      const [dumpResult, sizes] = await Promise.all([
        adbService.shell(serial, `dumpsys package ${packageName}`),
        this.getAppSize(serial, packageName, apkPath),
      ]);
      const dump = dumpResult.stdout;

      const versionName = this.extractField(dump, 'versionName') || '';
      const enabled = !dump.includes('enabled=2') && !dump.includes('enabled=3');

      let appType: AppType = 'user';
      if (apkPath.startsWith('/system/')) {
        appType = 'system';
      } else if (apkPath.startsWith('/product/') || apkPath.startsWith('/vendor/')) {
        appType = 'preinstalled';
      }

      // Extract label from dumpsys output — avoids a separate ADB call
      const labelMatch = dump.match(/non-localized-label:(.+)/);
      const appName = (labelMatch ? labelMatch[1].trim() : null) || packageName;

      return {
        packageName,
        appName,
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

  private async getAppSize(
    serial: string,
    packageName: string,
    apkPath: string
  ): Promise<{ total: number; data: number; cache: number }> {
    try {
      const [sizeResult, duResult] = await Promise.all([
        adbService.shell(serial, `stat -c %s "${apkPath}" 2>/dev/null || echo 0`),
        adbService.shell(
          serial,
          `du -s /data/data/${packageName} /data/data/${packageName}/cache 2>/dev/null; true`
        ),
      ]);

      const total = parseInt(sizeResult.stdout.trim(), 10) || 0;

      const duLines = duResult.stdout.trim().split('\n');
      const data = (parseInt(duLines[0]?.split(/\s/)[0] || '0', 10) || 0) * 1024;
      const cache = (parseInt(duLines[1]?.split(/\s/)[0] || '0', 10) || 0) * 1024;

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

  async clearData(serial: string, packageName: string): Promise<AppActionResult> {
    const result = await adbService.shell(serial, `pm clear ${packageName}`);
    const success = result.stdout.includes('Success');
    return {
      success,
      action: 'clear-data',
      message: success ? 'App data cleared successfully' : `Failed to clear data: ${result.stderr || result.stdout}`,
    };
  }

  async launchApp(serial: string, packageName: string): Promise<AppActionResult> {
    const result = await adbService.shell(serial, `monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`);
    const success = result.exitCode === 0;
    return {
      success,
      action: 'launch',
      message: success ? 'App launched successfully' : `Failed to launch: ${result.stderr}`,
    };
  }

  async getPermissions(serial: string, packageName: string): Promise<AppPermission[]> {
    const result = await adbService.shell(serial, `dumpsys package ${packageName}`);
    const dump = result.stdout;
    const permissions: AppPermission[] = [];

    const runtimeSection = dump.match(/runtime permissions:[\s\S]*?(?=\n\s*\S+:|$)/g);
    if (runtimeSection) {
      for (const section of runtimeSection) {
        const lines = section.split('\n');
        for (const line of lines) {
          const match = line.match(/([a-zA-Z][a-zA-Z0-9_.]*): granted=(true|false)/);
          if (match) {
            permissions.push({
              permission: match[1],
              granted: match[2] === 'true',
            });
          }
        }
      }
    }

    const seen = new Set<string>();
    return permissions.filter((p) => {
      if (seen.has(p.permission)) return false;
      seen.add(p.permission);
      return true;
    });
  }

  async grantPermission(serial: string, packageName: string, permission: string): Promise<AppActionResult> {
    const result = await adbService.shell(serial, `pm grant ${packageName} ${permission}`);
    const success = result.exitCode === 0 && !result.stderr.includes('Exception');
    return {
      success,
      action: 'grant',
      message: success ? `Permission ${permission} granted` : `Failed to grant: ${result.stderr || result.stdout}`,
    };
  }

  async revokePermission(serial: string, packageName: string, permission: string): Promise<AppActionResult> {
    const result = await adbService.shell(serial, `pm revoke ${packageName} ${permission}`);
    const success = result.exitCode === 0 && !result.stderr.includes('Exception');
    return {
      success,
      action: 'revoke',
      message: success ? `Permission ${permission} revoked` : `Failed to revoke: ${result.stderr || result.stdout}`,
    };
  }

  async getApkPath(serial: string, packageName: string): Promise<string> {
    const result = await adbService.shell(serial, `pm path ${packageName}`);
    const line = result.stdout.split('\n').find((l) => l.startsWith('package:'));
    if (!line) throw new Error('APK path not found');
    return line.replace('package:', '').trim();
  }

  async pullApk(serial: string, remotePath: string, localPath: string): Promise<void> {
    await adbService.executeForDevice(serial, ['pull', remotePath, localPath], config.uploadTimeout);
  }

  async backupApp(serial: string, packageName: string, localPath: string): Promise<boolean> {
    await adbService.executeForDevice(serial, ['backup', '-f', localPath, '-noapk', packageName], config.uploadTimeout);
    try {
      const stat = fs.statSync(localPath);
      return stat.size > 0;
    } catch {
      return false;
    }
  }

  async restoreApp(serial: string, localPath: string): Promise<AppActionResult> {
    const result = await adbService.execute(['restore', localPath], config.uploadTimeout);
    const output = result.stdout + result.stderr;
    const success = result.exitCode === 0;
    return {
      success,
      action: 'restore',
      message: success ? 'Restore started — confirm on device' : `Restore failed: ${output.trim()}`,
    };
  }
}

export const appService = new AppService();
