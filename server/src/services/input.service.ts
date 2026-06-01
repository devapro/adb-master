import { adbService } from './adb.service';

/**
 * Thrown when the device rejects input injection.
 *
 * The most common cause is Xiaomi MIUI/HyperOS, where the normal "USB debugging"
 * toggle is NOT enough — a separate developer option, "USB debugging (Security
 * settings)", must be enabled to simulate taps/swipes/text. When it is off the
 * `input` command is rejected with a SecurityException (requires INJECT_EVENTS).
 */
export class InputInjectionBlockedError extends Error {
  constructor() {
    super(
      'Input injection was rejected by the device. On Xiaomi (MIUI/HyperOS) phones, ' +
        'enable "USB debugging (Security settings)" in Developer Options — it is a ' +
        'separate switch from the normal "USB debugging" toggle and is required to ' +
        'simulate taps, swipes and text. Note that it can auto-revert and may require ' +
        'a signed-in Xiaomi account and a SIM card to enable.'
    );
    this.name = 'InputInjectionBlockedError';
  }
}

class InputService {
  /**
   * Run an `input` shell command and decide whether injection actually happened.
   *
   * The Android `input` command is unreliable about exit codes — on some devices
   * it exits 0 even when injection is denied, writing the error only to stderr.
   * So we inspect stdout+stderr for the well-known rejection signatures (which is
   * what fires on Xiaomi when "USB debugging (Security settings)" is off) and
   * throw a clear, actionable error instead of silently reporting success.
   */
  private async runInput(serial: string, command: string): Promise<boolean> {
    const result = await adbService.shell(serial, command);
    const output = `${result.stdout}\n${result.stderr}`;

    if (this.isInjectionBlocked(output)) {
      throw new InputInjectionBlockedError();
    }

    return result.exitCode === 0 && !/error|exception/i.test(result.stderr);
  }

  private isInjectionBlocked(output: string): boolean {
    return /INJECT_EVENTS|Injecting to another application|Permission Denial|SecurityException/i.test(
      output
    );
  }

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
    return this.runInput(serial, `input text "${escaped}"`);
  }

  async sendTap(serial: string, x: number, y: number): Promise<boolean> {
    return this.runInput(serial, `input tap ${x} ${y}`);
  }

  async sendLongTap(serial: string, x: number, y: number, duration: number): Promise<boolean> {
    // Long tap = swipe with same start/end point and held duration
    return this.runInput(serial, `input swipe ${x} ${y} ${x} ${y} ${duration}`);
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
    return this.runInput(serial, parts.join(' '));
  }

  async sendKeyEvent(serial: string, keycode: number | string): Promise<boolean> {
    return this.runInput(serial, `input keyevent ${keycode}`);
  }
}

export const inputService = new InputService();
