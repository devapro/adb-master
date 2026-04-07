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
}

export const deviceService = new DeviceService();
