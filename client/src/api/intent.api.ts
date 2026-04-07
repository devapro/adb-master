import api from './axios-client';
import { IntentParams, IntentResult, ApiResponse } from '../types';

export const sendIntent = (serial: string, params: IntentParams) =>
  api
    .post<ApiResponse<IntentResult>>(`/devices/${serial}/intent`, params)
    .then((r) => r.data.data);
