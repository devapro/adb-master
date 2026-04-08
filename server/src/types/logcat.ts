export type LogLevel = 'V' | 'D' | 'I' | 'W' | 'E' | 'F';

export interface LogcatLine {
  timestamp: string;
  pid: number;
  tid: number;
  level: LogLevel;
  tag: string;
  message: string;
  raw: string;
}

export interface LogcatFilter {
  level?: LogLevel;
  tag?: string;
  search?: string;
  packageName?: string;
}
