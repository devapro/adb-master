export type DeviceState = 'device' | 'offline' | 'unauthorized' | 'no permissions';

export interface Device {
  serial: string;
  state: DeviceState;
  model: string;
  product: string;
  transportId: string;
}
