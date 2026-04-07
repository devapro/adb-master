import api from './axios-client';
import { PortForwardList, ApiResponse } from '../types';

export const listPorts = (serial: string) =>
  api.get<ApiResponse<PortForwardList>>(`/devices/${serial}/ports`).then((r) => r.data.data);

export const addForward = (serial: string, localPort: number, remotePort: number) =>
  api.post(`/devices/${serial}/ports/forward`, { localPort, remotePort });

export const removeForward = (serial: string, localPort: number) =>
  api.delete(`/devices/${serial}/ports/forward`, { data: { localPort } });

export const addReverse = (serial: string, localPort: number, remotePort: number) =>
  api.post(`/devices/${serial}/ports/reverse`, { localPort, remotePort });

export const removeReverse = (serial: string, remotePort: number) =>
  api.delete(`/devices/${serial}/ports/reverse`, { data: { remotePort } });
