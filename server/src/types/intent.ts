export interface IntentExtra {
  type: 'string' | 'int' | 'bool' | 'float' | 'long';
  key: string;
  value: string;
}

export interface IntentParams {
  action?: string;
  data?: string;
  component?: string;
  category?: string;
  extras?: IntentExtra[];
  flags?: string;
}

export interface IntentResult {
  success: boolean;
  output: string;
}
