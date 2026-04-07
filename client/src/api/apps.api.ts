import api from './axios-client';
import { AppInfo, AppActionResult, AppPermission, ApiResponse } from '../types';

export const getApps = (serial: string, type: string = 'all') =>
  api
    .get<ApiResponse<AppInfo[]>>(`/devices/${serial}/apps`, { params: { type }, timeout: 3 * 60 * 1000 })
    .then((r) => r.data.data);

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

export const clearAppData = (serial: string, packageName: string) =>
  api.post<ApiResponse<AppActionResult>>(`/devices/${serial}/apps/${packageName}/clear`).then((r) => r.data.data);

export const launchApp = (serial: string, packageName: string) =>
  api.post<ApiResponse<AppActionResult>>(`/devices/${serial}/apps/${packageName}/launch`).then((r) => r.data.data);

export const getPermissions = (serial: string, packageName: string) =>
  api.get<ApiResponse<AppPermission[]>>(`/devices/${serial}/apps/${packageName}/permissions`).then((r) => r.data.data);

export const grantPermission = (serial: string, packageName: string, permission: string) =>
  api.post<ApiResponse<AppActionResult>>(`/devices/${serial}/apps/${packageName}/permissions/grant`, { permission }).then((r) => r.data.data);

export const revokePermission = (serial: string, packageName: string, permission: string) =>
  api.post<ApiResponse<AppActionResult>>(`/devices/${serial}/apps/${packageName}/permissions/revoke`, { permission }).then((r) => r.data.data);

export const extractApk = async (serial: string, packageName: string) => {
  const response = await api.get(`/devices/${serial}/apps/${packageName}/apk`, {
    responseType: 'blob',
    timeout: 10 * 60 * 1000,
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${packageName}.apk`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const backupApp = async (serial: string, packageName: string) => {
  const response = await api.get(`/devices/${serial}/apps/${packageName}/backup`, {
    responseType: 'blob',
    timeout: 10 * 60 * 1000,
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${packageName}.ab`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const restoreApp = (serial: string, packageName: string, file: File) => {
  const formData = new FormData();
  formData.append('backup', file);
  return api
    .post<ApiResponse<AppActionResult>>(`/devices/${serial}/apps/${packageName}/restore`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 10 * 60 * 1000,
    })
    .then((r) => r.data.data);
};
