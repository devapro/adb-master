import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useDeviceStore } from '../../store/device.store';
import { useConnectionStore } from '../../store/connection.store';
import { devicesSocket } from '../../socket/socket-client';
import { getDevices } from '../../api/devices.api';
import { Device } from '../../types';
import './AppShell.css';

const RELAY_POLL_INTERVAL = 3000;

export const AppShell: React.FC = () => {
  const setDevices = useDeviceStore((s) => s.setDevices);
  const connectionMode = useConnectionStore((s) => s.mode);
  const connected = useConnectionStore((s) => s.connected);

  // Socket.IO-based device polling (local mode)
  useEffect(() => {
    if (connectionMode === 'remote') return;

    devicesSocket.connect();

    devicesSocket.on('devices:changed', (devices: Device[]) => {
      setDevices(devices);
    });

    return () => {
      devicesSocket.off('devices:changed');
      devicesSocket.disconnect();
    };
  }, [setDevices, connectionMode, connected]);

  // HTTP-based device polling (relay/remote mode)
  useEffect(() => {
    if (connectionMode !== 'remote') return;

    let active = true;

    const poll = () => {
      getDevices()
        .then((devices) => {
          if (active) setDevices(devices);
        })
        .catch(() => {
          // relay unreachable — clear device list
          if (active) setDevices([]);
        });
    };

    poll();
    const timer = setInterval(poll, RELAY_POLL_INTERVAL);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [setDevices, connectionMode, connected]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Header />
        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
