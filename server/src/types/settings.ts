export type SettingsNamespace = 'system' | 'secure' | 'global';

export interface Setting {
  key: string;
  value: string;
}
