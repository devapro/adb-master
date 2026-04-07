import api from './axios-client';
import { WifiStatus, ProxySettings, ApiResponse } from '../types';

export const getWifi = (serial: string) =>
  api.get<ApiResponse<WifiStatus>>(`/devices/${serial}/network/wifi`).then((r) => r.data.data);

export const setWifi = (serial: string, enabled: boolean) =>
  api.post(`/devices/${serial}/network/wifi`, { enabled });

export const getProxy = (serial: string) =>
  api.get<ApiResponse<ProxySettings | null>>(`/devices/${serial}/network/proxy`).then((r) => r.data.data);

export const setProxy = (serial: string, settings: ProxySettings) =>
  api.put(`/devices/${serial}/network/proxy`, settings);

export const clearProxy = (serial: string) =>
  api.delete(`/devices/${serial}/network/proxy`);
