import api from './axios-client';
import { Device, ApiResponse } from '../types';

export const getDevices = () =>
  api.get<ApiResponse<Device[]>>('/devices').then((r) => r.data.data);

export const getDevice = (serial: string) =>
  api.get<ApiResponse<Device>>(`/devices/${serial}`).then((r) => r.data.data);
