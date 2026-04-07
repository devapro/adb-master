import { Namespace } from 'socket.io';
import { deviceService } from '../services/device.service';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Device } from '../types';

export function setupDeviceSocket(nsp: Namespace): void {
  let lastDeviceJson = '';

  const pollDevices = async () => {
    try {
      const devices = await deviceService.getDevices();
      const json = JSON.stringify(devices);

      if (json !== lastDeviceJson) {
        lastDeviceJson = json;
        nsp.emit('devices:changed', devices);
      }
    } catch (err) {
      logger.error(`Device polling error: ${err}`);
    }
  };

  let interval: NodeJS.Timeout | null = null;

  nsp.on('connection', (socket) => {
    logger.info(`Device socket connected: ${socket.id}`);

    if (!interval) {
      interval = setInterval(pollDevices, config.devicePollInterval);
      pollDevices();
    }

    // Send current state immediately
    const cached = deviceService.getCachedDevices();
    socket.emit('devices:changed', cached);

    socket.on('disconnect', () => {
      logger.info(`Device socket disconnected: ${socket.id}`);
      if (nsp.sockets.size === 0 && interval) {
        clearInterval(interval);
        interval = null;
      }
    });
  });
}
