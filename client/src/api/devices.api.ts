import api from './axios-client';
import { Device, ApiResponse } from '../types';

interface WirelessResult {
  success: boolean;
  message: string;
}

export const getDevices = () =>
  api.get<ApiResponse<Device[]>>('/devices').then((r) => r.data.data);

export const getDevice = (serial: string) =>
  api.get<ApiResponse<Device>>(`/devices/${serial}`).then((r) => r.data.data);

export const connectWireless = (host: string, port: number) =>
  api.post<ApiResponse<WirelessResult>>('/devices/connect', { host, port }).then((r) => r.data.data);

export const disconnectWireless = (address: string) =>
  api.post<ApiResponse<WirelessResult>>('/devices/disconnect', { address }).then((r) => r.data.data);

export const enableTcpip = (serial: string, port: number = 5555) =>
  api.post<ApiResponse<WirelessResult>>(`/devices/${serial}/tcpip`, { port }).then((r) => r.data.data);
