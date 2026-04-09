import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { DevicesPage } from './pages/DevicesPage';
import { AppsPage } from './pages/AppsPage';
import { FilesPage } from './pages/FilesPage';
import { NetworkPage } from './pages/NetworkPage';
import { LogcatPage } from './pages/LogcatPage';
import { TerminalPage } from './pages/TerminalPage';
import { DeviceInfoPage } from './pages/DeviceInfoPage';
import { InputPage } from './pages/InputPage';
import { SettingsPage } from './pages/SettingsPage';
import { ScreenPage } from './pages/ScreenPage';
import { ToastContainer } from './components/common/Toast';
import { CommandProgress } from './components/common/CommandProgress';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastContainer />
      <CommandProgress />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/devices" replace />} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/apps/:serial" element={<AppsPage />} />
          <Route path="/files/:serial" element={<FilesPage />} />
          <Route path="/network/:serial" element={<NetworkPage />} />
          <Route path="/logcat/:serial" element={<LogcatPage />} />
          <Route path="/terminal/:serial" element={<TerminalPage />} />
          <Route path="/devices/:serial/info" element={<DeviceInfoPage />} />
          <Route path="/devices/:serial/input" element={<InputPage />} />
          <Route path="/devices/:serial/settings" element={<SettingsPage />} />
          <Route path="/screen/:serial" element={<ScreenPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
