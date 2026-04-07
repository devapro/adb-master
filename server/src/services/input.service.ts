import { adbService } from './adb.service';

class InputService {
  async sendText(serial: string, text: string): Promise<boolean> {
    const escaped = text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/ /g, '%s')
      .replace(/&/g, '\\&')
      .replace(/</g, '\\<')
      .replace(/>/g, '\\>')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
    const result = await adbService.shell(serial, `input text "${escaped}"`);
    return result.exitCode === 0;
  }

  async sendTap(serial: string, x: number, y: number): Promise<boolean> {
    const result = await adbService.shell(serial, `input tap ${x} ${y}`);
    return result.exitCode === 0;
  }

  async sendSwipe(
    serial: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    duration?: number
  ): Promise<boolean> {
    const parts = ['input', 'swipe', x1, y1, x2, y2];
    if (duration !== undefined) parts.push(duration);
    const result = await adbService.shell(serial, parts.join(' '));
    return result.exitCode === 0;
  }

  async sendKeyEvent(serial: string, keycode: number | string): Promise<boolean> {
    const result = await adbService.shell(serial, `input keyevent ${keycode}`);
    return result.exitCode === 0;
  }
}

export const inputService = new InputService();
