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
        return { apkPath: match[1], packageName: match[2].trim() };
      })
      .filter((p): p is { apkPath: string; packageName: string } => p !== null);

    // Batch-fetch all sizes in a few ADB calls instead of 2 per package
    const sizeMap = await this.batchGetSizes(serial, packages);

    // Batch-fetch dumpsys info using shell for-loops (20 packages per ADB call)
    const BATCH = 20;
    const apps: AppInfo[] = [];
    for (let i = 0; i < packages.length; i += BATCH) {
      const batch = packages.slice(i, i + BATCH);
      const dumpMap = await this.batchGetDumpsys(serial, batch.map((p) => p.packageName));
      for (const pkg of batch) {
        const dump = dumpMap.get(pkg.packageName) || '';
        const sizes = sizeMap.get(pkg.packageName) || { total: 0, data: 0, cache: 0 };
        apps.push(this.parseAppDetail(pkg.packageName, pkg.apkPath, dump, sizes));
      }
    }

    return apps;
  }

  private parseAppDetail(
    packageName: string,
    apkPath: string,
    dump: string,
    sizes: { total: number; data: number; cache: number }
  ): AppInfo {
    const versionName = this.extractField(dump, 'versionName') || '';
    const enabled = !dump.includes('enabled=2') && !dump.includes('enabled=3');

    let appType: AppType = 'user';
    if (apkPath.startsWith('/system/')) {
      appType = 'system';
    } else if (apkPath.startsWith('/product/') || apkPath.startsWith('/vendor/')) {
      appType = 'preinstalled';
    }

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
  }

  /**
   * Fetch dumpsys for multiple packages in a single ADB shell call.
   * Uses a for-loop with grep to extract only the fields we need,
   * keeping output small and fast.
   */
  private async batchGetDumpsys(
    serial: string,
    packageNames: string[]
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (packageNames.length === 0) return map;

    try {
      const pkgList = packageNames.join(' ');
      const cmd = `for pkg in ${pkgList}; do echo "===PKG:$pkg==="; dumpsys package $pkg 2>/dev/null | grep -E 'versionName|enabled=|non-localized-label' | head -5; done`;
      const result = await adbService.shell(serial, cmd);

      let currentPkg = '';
      let currentDump = '';
      for (const line of result.stdout.split('\n')) {
        const marker = line.match(/^===PKG:(.+)===$/);
        if (marker) {
          if (currentPkg) map.set(currentPkg, currentDump);
          currentPkg = marker[1];
          currentDump = '';
        } else {
          currentDump += line + '\n';
        }
      }
      if (currentPkg) map.set(currentPkg, currentDump);
    } catch {
      // On failure, return empty map — apps will get default values
    }

    return map;
  }

  /**
   * Batch-fetch sizes for all packages using bulk du/stat commands.
   * Reduces ~400 ADB calls to ~4.
   */
  private async batchGetSizes(
    serial: string,
    packages: { apkPath: string; packageName: string }[]
  ): Promise<Map<string, { total: number; data: number; cache: number }>> {
    const map = new Map<string, { total: number; data: number; cache: number }>();

    try {
      // Batch stat APK sizes — chunk paths to avoid ARG_MAX
      const apkSizeByPath = new Map<string, number>();
      const STAT_CHUNK = 50;
      for (let i = 0; i < packages.length; i += STAT_CHUNK) {
        const chunk = packages.slice(i, i + STAT_CHUNK);
        const paths = chunk.map((p) => `"${p.apkPath}"`).join(' ');
        const result = await adbService.shell(serial, `stat -c '%s %n' ${paths} 2>/dev/null; true`);
        for (const line of result.stdout.split('\n')) {
          const match = line.match(/^(\d+)\s+(.+)$/);
          if (match) apkSizeByPath.set(match[2].trim(), parseInt(match[1], 10));
        }
      }

      // Batch du for all data directories (1 ADB call)
      const dataSizeByPkg = new Map<string, number>();
      const duData = await adbService.shell(serial, 'du -s /data/data/*/ 2>/dev/null; true');
      for (const line of duData.stdout.split('\n')) {
        const match = line.match(/^(\d+)\s+\/data\/data\/([^/]+)/);
        if (match) dataSizeByPkg.set(match[2], (parseInt(match[1], 10) || 0) * 1024);
      }

      // Batch du for all cache directories (1 ADB call)
      const cacheSizeByPkg = new Map<string, number>();
      const duCache = await adbService.shell(serial, 'du -s /data/data/*/cache 2>/dev/null; true');
      for (const line of duCache.stdout.split('\n')) {
        const match = line.match(/^(\d+)\s+\/data\/data\/([^/]+)/);
        if (match) cacheSizeByPkg.set(match[2], (parseInt(match[1], 10) || 0) * 1024);
      }

      for (const pkg of packages) {
        map.set(pkg.packageName, {
          total: apkSizeByPath.get(pkg.apkPath) || 0,
          data: dataSizeByPkg.get(pkg.packageName) || 0,
          cache: cacheSizeByPkg.get(pkg.packageName) || 0,
        });
      }
    } catch {
      // On failure, sizes remain 0
    }

    return map;
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

  async clearCache(serial: string, packageName: string): Promise<AppActionResult> {
    // run-as works for debuggable apps; direct rm may work on rooted devices
    const result = await adbService.shell(
      serial,
      `run-as ${packageName} sh -c 'rm -rf ./cache/* ./code_cache/* 2>/dev/null' 2>/dev/null && echo __CACHE_OK__`
    );
    if (result.stdout.includes('__CACHE_OK__')) {
      return { success: true, action: 'clear-cache', message: 'App cache cleared successfully' };
    }

    const fallback = await adbService.shell(
      serial,
      `rm -rf /data/data/${packageName}/cache/* /data/data/${packageName}/code_cache/* 2>/dev/null && echo __CACHE_OK__`
    );
    if (fallback.stdout.includes('__CACHE_OK__')) {
      return { success: true, action: 'clear-cache', message: 'App cache cleared successfully' };
    }

    return {
      success: false,
      action: 'clear-cache',
      message: 'Cannot clear cache only — use Clear Data to clear everything',
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
