import { Device } from '../types';
import { adbService } from './adb.service';
import { parseDeviceList } from '../utils/adb-parser';

class DeviceService {
  private cachedDevices: Device[] = [];

  async getDevices(): Promise<Device[]> {
    const result = await adbService.execute(['devices', '-l']);
    this.cachedDevices = parseDeviceList(result.stdout);
    return this.cachedDevices;
  }

  async getDevice(serial: string): Promise<Device | undefined> {
    const devices = await this.getDevices();
    return devices.find((d) => d.serial === serial);
  }

  getCachedDevices(): Device[] {
    return this.cachedDevices;
  }

  async connectDevice(host: string, port: number): Promise<{ success: boolean; message: string }> {
    const address = `${host}:${port}`;
    const result = await adbService.execute(['connect', address]);
    const output = result.stdout.trim() || result.stderr.trim();
    const success = output.includes('connected to');
    return { success, message: output };
  }

  async disconnectDevice(address: string): Promise<{ success: boolean; message: string }> {
    const result = await adbService.execute(['disconnect', address]);
    const output = result.stdout.trim() || result.stderr.trim();
    const success = output.includes('disconnected');
    return { success, message: output };
  }

  async enableTcpip(serial: string, port: number): Promise<{ success: boolean; message: string }> {
    const result = await adbService.executeForDevice(serial, ['tcpip', String(port)]);
    const output = result.stdout.trim() || result.stderr.trim();
    const success = output.includes('restarting in TCP mode') || result.exitCode === 0;
    return { success, message: output };
  }
}

export const deviceService = new DeviceService();
