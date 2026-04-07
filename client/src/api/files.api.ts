import api from './axios-client';
import { FileEntry, StorageSummary, ApiResponse } from '../types';

export const getFiles = (serial: string, path: string = '/sdcard', minSize: number = 0) =>
  api.get<ApiResponse<FileEntry[]>>(`/devices/${serial}/files`, { params: { path, minSize } }).then((r) => r.data.data);

export const getLargeFiles = (serial: string, path: string = '/sdcard', limit: number = 50) =>
  api.get<ApiResponse<FileEntry[]>>(`/devices/${serial}/files/large`, { params: { path, limit } }).then((r) => r.data.data);

export const getStorage = (serial: string) =>
  api.get<ApiResponse<StorageSummary>>(`/devices/${serial}/storage`).then((r) => r.data.data);

export const uploadFile = (
  serial: string,
  file: File,
  devicePath: string,
  onProgress?: (percent: number) => void
) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('path', devicePath);
  return api
    .post<ApiResponse<{ success: boolean }>>(`/devices/${serial}/files/upload`, formData, {
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

export const downloadFile = (serial: string, devicePath: string) =>
  api
    .get(`/devices/${serial}/files/download`, {
      params: { path: devicePath },
      responseType: 'blob',
      timeout: 10 * 60 * 1000,
    })
    .then((r) => {
      const fileName = devicePath.split('/').pop() || 'download';
      const url = window.URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    });

export const deleteFile = (serial: string, path: string, isDirectory: boolean = false) =>
  api.delete<ApiResponse<{ success: boolean }>>(`/devices/${serial}/files`, { data: { path, isDirectory } }).then((r) => r.data.data);
