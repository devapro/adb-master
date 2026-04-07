import api from './axios-client';
import { AppInfo, AppActionResult, ApiResponse } from '../types';

export const getApps = (serial: string, type: string = 'all') =>
  api.get<ApiResponse<AppInfo[]>>(`/devices/${serial}/apps`, { params: { type } }).then((r) => r.data.data);

export const installApk = (
  serial: string,
  file: File,
  onProgress?: (percent: number) => void
) => {
  const formData = new FormData();
  formData.append('apk', file);
  return api
    .post<ApiResponse<AppActionResult>>(`/devices/${serial}/apps/install`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 10 * 60 * 1000,
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    })
    .then((r) => r.data.data);
};

export const uninstallApp = (serial: string, packageName: string) =>
  api.delete<ApiResponse<AppActionResult>>(`/devices/${serial}/apps/${packageName}`).then((r) => r.data.data);

export const disableApp = (serial: string, packageName: string) =>
  api.post<ApiResponse<AppActionResult>>(`/devices/${serial}/apps/${packageName}/disable`).then((r) => r.data.data);

export const stopApp = (serial: string, packageName: string) =>
  api.post<ApiResponse<AppActionResult>>(`/devices/${serial}/apps/${packageName}/stop`).then((r) => r.data.data);
