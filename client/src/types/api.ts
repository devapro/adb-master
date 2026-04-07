export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
  code: number;
}

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ScriptResult {
  results: string[];
}
