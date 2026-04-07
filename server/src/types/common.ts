export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
  code: number;
}
