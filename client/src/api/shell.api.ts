import api from './axios-client';
import { ShellResult, ScriptResult, ApiResponse } from '../types';

export const executeCommand = (serial: string, command: string) =>
  api.post<ApiResponse<ShellResult>>(`/devices/${serial}/shell`, { command }).then((r) => r.data.data);

export const uploadScript = (serial: string, file: File) => {
  const formData = new FormData();
  formData.append('script', file);
  return api
    .post<ApiResponse<ScriptResult>>(`/devices/${serial}/shell/script`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    })
    .then((r) => r.data.data);
};

// Managed shell session endpoints (relay mode)
export const openShellSession = (serial: string) =>
  api.post(`/devices/${serial}/shell/session`).then((r) => r.data.data);

export const pollShellSession = (serial: string) =>
  api
    .get<ApiResponse<{ active: boolean; output: string }>>(`/devices/${serial}/shell/session`)
    .then((r) => r.data.data);

export const sendShellInput = (serial: string, data: string) =>
  api.post(`/devices/${serial}/shell/session/input`, { data }).then((r) => r.data.data);

export const closeShellSession = (serial: string) =>
  api.delete(`/devices/${serial}/shell/session`).then((r) => r.data.data);
