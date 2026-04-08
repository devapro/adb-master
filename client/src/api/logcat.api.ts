import api from './axios-client';
import { LogcatLine, ApiResponse } from '../types';

export const getSnapshot = (serial: string, lines: number = 500) =>
  api.get<ApiResponse<LogcatLine[]>>(`/devices/${serial}/logcat/snapshot`, { params: { lines } }).then((r) => r.data.data);

export const clearLogcat = (serial: string) =>
  api.post(`/devices/${serial}/logcat/clear`);

// Managed stream endpoints (relay mode)
export const startLogcatStream = (serial: string, filters?: { level?: string; tag?: string }) =>
  api.post(`/devices/${serial}/logcat/stream`, { filters }).then((r) => r.data.data);

export const pollLogcatStream = (serial: string, since: number = 0) =>
  api
    .get<ApiResponse<{ active: boolean; lines: LogcatLine[]; cursor: number }>>(
      `/devices/${serial}/logcat/stream`,
      { params: { since } }
    )
    .then((r) => r.data.data);

export const stopLogcatStream = (serial: string) =>
  api.delete(`/devices/${serial}/logcat/stream`).then((r) => r.data.data);
