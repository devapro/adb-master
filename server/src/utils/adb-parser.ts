import { Device, DeviceState, LogcatLine, LogLevel } from '../types';

const DEVICE_LINE_REGEX = /^(\S+)\s+(device|offline|unauthorized|no permissions)(.*)$/;

export function parseDeviceList(output: string): Device[] {
  const lines = output.split('\n').filter((l) => l.trim() && !l.startsWith('List'));
  return lines
    .map((line) => {
      const match = line.match(DEVICE_LINE_REGEX);
      if (!match) return null;

      const serial = match[1];
      const state = match[2] as DeviceState;
      const rest = match[3] || '';

      const model = extractProp(rest, 'model') || 'Unknown';
      const product = extractProp(rest, 'product') || 'Unknown';
      const transportId = extractProp(rest, 'transport_id') || '';

      return { serial, state, model, product, transportId };
    })
    .filter((d): d is Device => d !== null);
}

function extractProp(str: string, key: string): string | null {
  const regex = new RegExp(`${key}:(\\S+)`);
  const match = str.match(regex);
  return match ? match[1] : null;
}

// Format: "MM-DD HH:MM:SS.mmm  PID  TID LEVEL TAG     : MESSAGE"
const LOGCAT_REGEX = /^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEF])\s+(.+?)\s*:\s+(.*)$/;

export function parseLogcatLine(raw: string): LogcatLine | null {
  const match = raw.match(LOGCAT_REGEX);
  if (!match) return null;

  return {
    timestamp: match[1],
    pid: parseInt(match[2], 10),
    tid: parseInt(match[3], 10),
    level: match[4] as LogLevel,
    tag: match[5].trim(),
    message: match[6],
    raw,
  };
}
