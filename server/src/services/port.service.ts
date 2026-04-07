import { PortForward } from '../types';
import { adbService } from './adb.service';

class PortService {
  async listForwards(serial: string): Promise<PortForward[]> {
    const result = await adbService.execute(['forward', '--list']);
    const lines = result.stdout.trim().split('\n').filter(Boolean);
    const forwards: PortForward[] = [];

    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts[0] !== serial) continue;
      const localMatch = parts[1]?.match(/^tcp:(\d+)$/);
      const remoteMatch = parts[2]?.match(/^tcp:(\d+)$/);
      if (localMatch && remoteMatch) {
        forwards.push({
          localPort: parseInt(localMatch[1], 10),
          remotePort: parseInt(remoteMatch[1], 10),
        });
      }
    }

    return forwards;
  }

  async addForward(serial: string, localPort: number, remotePort: number): Promise<boolean> {
    const result = await adbService.executeForDevice(serial, [
      'forward',
      `tcp:${localPort}`,
      `tcp:${remotePort}`,
    ]);
    return result.exitCode === 0;
  }

  async removeForward(serial: string, localPort: number): Promise<boolean> {
    const result = await adbService.executeForDevice(serial, [
      'forward',
      '--remove',
      `tcp:${localPort}`,
    ]);
    return result.exitCode === 0;
  }

  async listReverses(serial: string): Promise<PortForward[]> {
    const result = await adbService.executeForDevice(serial, ['reverse', '--list']);
    const lines = result.stdout.trim().split('\n').filter(Boolean);
    const reverses: PortForward[] = [];

    for (const line of lines) {
      const parts = line.split(/\s+/);
      const remoteMatch = parts[0]?.match(/^tcp:(\d+)$/) || parts[1]?.match(/^tcp:(\d+)$/);
      const localMatch = parts[1]?.match(/^tcp:(\d+)$/) || parts[2]?.match(/^tcp:(\d+)$/);
      if (remoteMatch && localMatch && remoteMatch !== localMatch) {
        reverses.push({
          localPort: parseInt(localMatch[1], 10),
          remotePort: parseInt(remoteMatch[1], 10),
        });
      }
    }

    return reverses;
  }

  async addReverse(serial: string, localPort: number, remotePort: number): Promise<boolean> {
    const result = await adbService.executeForDevice(serial, [
      'reverse',
      `tcp:${remotePort}`,
      `tcp:${localPort}`,
    ]);
    return result.exitCode === 0;
  }

  async removeReverse(serial: string, remotePort: number): Promise<boolean> {
    const result = await adbService.executeForDevice(serial, [
      'reverse',
      '--remove',
      `tcp:${remotePort}`,
    ]);
    return result.exitCode === 0;
  }
}

export const portService = new PortService();
