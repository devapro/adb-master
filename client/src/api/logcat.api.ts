import api from './axios-client';
import { LogcatLine, ApiResponse } from '../types';

export const getSnapshot = (serial: string, lines: number = 500) =>
  api.get<ApiResponse<LogcatLine[]>>(`/devices/${serial}/logcat/snapshot`, { params: { lines } }).then((r) => r.data.data);

export const clearLogcat = (serial: string) =>
  api.post(`/devices/${serial}/logcat/clear`);
