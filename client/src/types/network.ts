export interface WifiStatus {
  enabled: boolean;
  ssid: string | null;
  ipAddress: string | null;
}

export interface ProxySettings {
  host: string;
  port: number;
  bypass?: string;
}
