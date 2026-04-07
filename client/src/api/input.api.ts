import api from './axios-client';
import { ApiResponse } from '../types';

interface InputResult {
  success: boolean;
}

export const sendText = (serial: string, text: string) =>
  api
    .post<ApiResponse<InputResult>>(`/devices/${serial}/input/text`, { text })
    .then((r) => r.data.data);

export const sendTap = (serial: string, x: number, y: number) =>
  api
    .post<ApiResponse<InputResult>>(`/devices/${serial}/input/tap`, { x, y })
    .then((r) => r.data.data);

export const sendSwipe = (
  serial: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  duration?: number
) =>
  api
    .post<ApiResponse<InputResult>>(`/devices/${serial}/input/swipe`, {
      x1,
      y1,
      x2,
      y2,
      duration,
    })
    .then((r) => r.data.data);

export const sendKeyEvent = (serial: string, keycode: number) =>
  api
    .post<ApiResponse<InputResult>>(`/devices/${serial}/input/keyevent`, { keycode })
    .then((r) => r.data.data);
