import api from './axios-client';
import { DeviceInfo, ApiResponse } from '../types';

export const getDeviceInfo = (serial: string) =>
  api.get<ApiResponse<DeviceInfo>>(`/devices/${serial}/info`).then((r) => r.data.data);

export const captureBugreport = async (serial: string): Promise<void> => {
  const response = await api.get(`/devices/${serial}/bugreport`, {
    responseType: 'blob',
    timeout: 10 * 60 * 1000,
  });
  const url = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bugreport-${serial}-${Date.now()}.zip`;
  a.click();
  URL.revokeObjectURL(url);
};

export const rebootDevice = (serial: string, mode: 'system' | 'recovery' | 'bootloader' = 'system') =>
  api.post<ApiResponse<{ success: boolean }>>(`/devices/${serial}/reboot`, { mode }).then((r) => r.data.data);
