import { create } from 'zustand';
import { Device } from '../types';

interface DeviceStore {
  devices: Device[];
  selectedSerial: string | null;
  setDevices: (devices: Device[]) => void;
  selectDevice: (serial: string | null) => void;
}

export const useDeviceStore = create<DeviceStore>((set, get) => ({
  devices: [],
  selectedSerial: null,
  setDevices: (devices) => {
    const current = get();
    set({ devices });
    // Auto-select first device if none selected or selected device disconnected
    if (
      devices.length > 0 &&
      (!current.selectedSerial || !devices.find((d) => d.serial === current.selectedSerial))
    ) {
      const online = devices.find((d) => d.state === 'device');
      set({ selectedSerial: online?.serial || devices[0].serial });
    }
    if (devices.length === 0) {
      set({ selectedSerial: null });
    }
  },
  selectDevice: (serial) => set({ selectedSerial: serial }),
}));
