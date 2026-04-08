export type AppType = 'system' | 'user' | 'preinstalled';

export interface AppInfo {
  packageName: string;
  appName: string;
  versionName: string;
  type: AppType;
  sizeBytes: number;
  dataSizeBytes: number;
  cacheSizeBytes: number;
  iconBase64: string | null;
  enabled: boolean;
}

export interface AppActionResult {
  success: boolean;
  action: 'install' | 'uninstall' | 'disable' | 'force-stop' | 'clear-data' | 'clear-cache' | 'launch' | 'grant' | 'revoke' | 'backup' | 'restore';
  message: string;
}

export interface AppPermission {
  permission: string;
  granted: boolean;
}
