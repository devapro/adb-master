export interface BatteryInfo {
  level: number;
  status: string;
  temperature: number;
  health: string;
}

export interface MemoryInfo {
  totalMB: number;
  usedMB: number;
  freeMB: number;
}

export interface CpuInfo {
  processor: string;
  cores: number;
  usage: number;
}

export interface DeviceInfo {
  model: string;
  manufacturer: string;
  brand: string;
  androidVersion: string;
  sdkVersion: string;
  buildNumber: string;
  serialNumber: string;
  screenResolution: string;
  screenDensity: number;
  battery: BatteryInfo;
  memory: MemoryInfo;
  cpu: CpuInfo;
}
