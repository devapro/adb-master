import api from './axios-client';
import { ApiResponse } from '../types';

export interface RelaySessionInfo {
  connected: boolean;
  sessionId: string | null;
  relayUrl: string;
  shareUrl: string | null;
  hasPassword: boolean;
}

export const getRelayStatus = () =>
  api
    .get<ApiResponse<RelaySessionInfo | null>>('/relay/status')
    .then((r) => r.data.data);
