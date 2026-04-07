import api from './axios-client';
import { Setting, SettingsNamespace, ApiResponse } from '../types';

export const listSettings = (serial: string, namespace: SettingsNamespace) =>
  api.get<ApiResponse<Setting[]>>(`/devices/${serial}/settings/${namespace}`).then((r) => r.data.data);

export const putSetting = (serial: string, namespace: SettingsNamespace, key: string, value: string) =>
  api.put<ApiResponse<{ success: boolean }>>(`/devices/${serial}/settings/${namespace}`, { key, value }).then((r) => r.data.data);

export const deleteSetting = (serial: string, namespace: SettingsNamespace, key: string) =>
  api.delete<ApiResponse<{ success: boolean }>>(`/devices/${serial}/settings/${namespace}/${encodeURIComponent(key)}`).then((r) => r.data.data);
