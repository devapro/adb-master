import fs from 'fs';
import { adbService } from './adb.service';
import { config } from '../config';
import { DeviceInfo, BatteryInfo, MemoryInfo, CpuInfo } from '../types';

class DeviceInfoService {
  async getDeviceInfo(serial: string): Promise<DeviceInfo> {
    const [
      model,
      manufacturer,
      brand,
      androidVersion,
      sdkVersion,
      buildNumber,
      serialNumber,
      screenSize,
      screenDensity,
      battery,
      memory,
      cpu,
    ] = await Promise.all([
      this.getProp(serial, 'ro.product.model'),
      this.getProp(serial, 'ro.product.manufacturer'),
      this.getProp(serial, 'ro.product.brand'),
      this.getProp(serial, 'ro.build.version.release'),
      this.getProp(serial, 'ro.build.version.sdk'),
      this.getProp(serial, 'ro.build.display.id'),
      this.getProp(serial, 'ro.serialno'),
      this.getScreenSize(serial),
      this.getScreenDensity(serial),
      this.getBattery(serial),
      this.getMemory(serial),
      this.getCpu(serial),
    ]);

    return {
      model,
      manufacturer,
      brand,
      androidVersion,
      sdkVersion,
      buildNumber,
      serialNumber,
      screenResolution: screenSize,
      screenDensity,
      battery,
      memory,
      cpu,
    };
  }

  private async getProp(serial: string, prop: string): Promise<string> {
    const result = await adbService.shell(serial, `getprop ${prop}`);
    return result.stdout.trim();
  }

  private async getScreenSize(serial: string): Promise<string> {
    const result = await adbService.shell(serial, 'wm size');
    const match = result.stdout.match(/(\d+x\d+)/);
    return match ? match[1] : 'Unknown';
  }

  private async getScreenDensity(serial: string): Promise<number> {
    const result = await adbService.shell(serial, 'wm density');
    const match = result.stdout.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private async getBattery(serial: string): Promise<BatteryInfo> {
    const result = await adbService.shell(serial, 'dumpsys battery');
    const lines = result.stdout;

    const statusMap: Record<string, string> = {
      '1': 'Unknown',
      '2': 'Charging',
      '3': 'Discharging',
      '4': 'Not charging',
      '5': 'Full',
    };

    const healthMap: Record<string, string> = {
      '1': 'Unknown',
      '2': 'Good',
      '3': 'Overheat',
      '4': 'Dead',
      '5': 'Over voltage',
      '6': 'Unspecified failure',
      '7': 'Cold',
    };

    const level = this.extractInt(lines, 'level');
    const statusCode = this.extractValue(lines, 'status');
    const temp = this.extractInt(lines, 'temperature');
    const healthCode = this.extractValue(lines, 'health');

    return {
      level,
      status: statusMap[statusCode] || statusCode,
      temperature: temp / 10,
      health: healthMap[healthCode] || healthCode,
    };
  }

  private async getMemory(serial: string): Promise<MemoryInfo> {
    const result = await adbService.shell(serial, 'cat /proc/meminfo');
    const lines = result.stdout;

    const totalKB = this.extractMemValue(lines, 'MemTotal');
    const availableKB = this.extractMemValue(lines, 'MemAvailable');
    const totalMB = Math.round(totalKB / 1024);
    const freeMB = Math.round(availableKB / 1024);

    return {
      totalMB,
      usedMB: totalMB - freeMB,
      freeMB,
    };
  }

  private async getCpu(serial: string): Promise<CpuInfo> {
    const [cpuInfoResult, usageResult] = await Promise.all([
      adbService.shell(serial, 'cat /proc/cpuinfo'),
      adbService.shell(serial, 'top -bn1 -n1'),
    ]);

    const cpuLines = cpuInfoResult.stdout;
    const processorMatch = cpuLines.match(/Hardware\s*:\s*(.+)/i)
      || cpuLines.match(/model name\s*:\s*(.+)/i)
      || cpuLines.match(/Processor\s*:\s*(.+)/i);
    const processor = processorMatch ? processorMatch[1].trim() : 'Unknown';

    const coreMatches = cpuLines.match(/^processor\s*:/gmi);
    const cores = coreMatches ? coreMatches.length : 1;

    let usage = 0;
    const cpuLineMatch = usageResult.stdout.match(/%cpu.*?(\d+)%idle/i)
      || usageResult.stdout.match(/(\d+)%idle/i);
    if (cpuLineMatch) {
      usage = 100 - parseInt(cpuLineMatch[1], 10);
    }

    return { processor, cores, usage };
  }

  private extractValue(text: string, key: string): string {
    const match = text.match(new RegExp(`${key}:\\s*(.+)`, 'i'));
    return match ? match[1].trim() : '0';
  }

  private extractInt(text: string, key: string): number {
    return parseInt(this.extractValue(text, key), 10) || 0;
  }

  private extractMemValue(text: string, key: string): number {
    const match = text.match(new RegExp(`${key}:\\s*(\\d+)`, 'i'));
    return match ? parseInt(match[1], 10) : 0;
  }

  async rebootDevice(serial: string, mode: 'system' | 'recovery' | 'bootloader' = 'system'): Promise<boolean> {
    const args = mode === 'system' ? ['reboot'] : ['reboot', mode];
    await adbService.executeForDevice(serial, args);
    return true;
  }

  async captureBugreport(serial: string, localPath: string): Promise<boolean> {
    await adbService.executeForDevice(serial, ['bugreport', localPath], config.uploadTimeout);
    return fs.existsSync(localPath);
  }
}

export const deviceInfoService = new DeviceInfoService();
