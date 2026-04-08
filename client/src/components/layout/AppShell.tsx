import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useDeviceStore } from '../../store/device.store';
import { useConnectionStore } from '../../store/connection.store';
import { devicesSocket } from '../../socket/socket-client';
import { Device } from '../../types';
import './AppShell.css';

export const AppShell: React.FC = () => {
  const setDevices = useDeviceStore((s) => s.setDevices);
  const connectionMode = useConnectionStore((s) => s.mode);
  const connected = useConnectionStore((s) => s.connected);

  useEffect(() => {
    devicesSocket.connect();

    devicesSocket.on('devices:changed', (devices: Device[]) => {
      setDevices(devices);
    });

    return () => {
      devicesSocket.off('devices:changed');
      devicesSocket.disconnect();
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
