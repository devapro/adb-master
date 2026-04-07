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
