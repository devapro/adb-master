export const ALLOWED_ADB_COMMANDS = new Set([
  'devices',
  'shell',
  'install',
  'uninstall',
  'push',
  'pull',
  'logcat',
  'forward',
  'reverse',
  'get-state',
  'disconnect',
]);

export const BLOCKED_SHELL_PATTERNS: RegExp[] = [
  /rm\s+-rf\s+\/(?!sdcard)/i,
  /\breboot\b/i,
  /\bflash\b/i,
  /\bformat\b/i,
  /\bdd\s+if=/i,
  /\bmkfs\b/i,
];

export function isCommandBlocked(command: string): boolean {
  return BLOCKED_SHELL_PATTERNS.some((pattern) => pattern.test(command));
}
