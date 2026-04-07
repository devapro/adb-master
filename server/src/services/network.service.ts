import { WifiStatus, ProxySettings } from '../types';
import { adbService } from './adb.service';

class NetworkService {
  async getWifiStatus(serial: string): Promise<WifiStatus> {
    const wifiResult = await adbService.shell(serial, 'settings get global wifi_on');
    const enabled = wifiResult.stdout.trim() === '1';

    let ssid: string | null = null;
    let ipAddress: string | null = null;

    if (enabled) {
      const ssidResult = await adbService.shell(
        serial,
        'dumpsys wifi | grep "mWifiInfo" | head -1'
      );
      const ssidMatch = ssidResult.stdout.match(/SSID:\s*"?([^",]+)"?/);
      ssid = ssidMatch ? ssidMatch[1] : null;

      const ipResult = await adbService.shell(
        serial,
        'ip addr show wlan0 | grep "inet "'
      );
      const ipMatch = ipResult.stdout.match(/inet\s+([\d.]+)/);
      ipAddress = ipMatch ? ipMatch[1] : null;
    }

    return { enabled, ssid, ipAddress };
  }

  async setWifi(serial: string, enabled: boolean): Promise<void> {
    await adbService.shell(serial, `svc wifi ${enabled ? 'enable' : 'disable'}`);
  }

  async getProxy(serial: string): Promise<ProxySettings | null> {
    const result = await adbService.shell(serial, 'settings get global http_proxy');
    const proxy = result.stdout.trim();

    if (!proxy || proxy === 'null' || proxy === ':0') return null;

    const parts = proxy.split(':');
    if (parts.length < 2) return null;

    const port = parseInt(parts[parts.length - 1], 10);
    const host = parts.slice(0, -1).join(':');

    return { host, port };
  }

  async setProxy(serial: string, settings: ProxySettings): Promise<void> {
    await adbService.shell(
      serial,
      `settings put global http_proxy ${settings.host}:${settings.port}`
    );
  }

  async clearProxy(serial: string): Promise<void> {
    await adbService.shell(serial, 'settings put global http_proxy :0');
  }
}

export const networkService = new NetworkService();
