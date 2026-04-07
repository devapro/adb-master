import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeviceStore } from '../store/device.store';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { connectWireless, disconnectWireless, enableTcpip, getDevices } from '../api/devices.api';
import { installApk } from '../api/apps.api';
import { executeCommand } from '../api/shell.api';
import { rebootDevice } from '../api/device-info.api';
import './DevicesPage.css';

const stateVariant = {
  device: 'success' as const,
  offline: 'danger' as const,
  unauthorized: 'warning' as const,
  'no permissions': 'danger' as const,
};

const isWirelessDevice = (serial: string) => /^\d+\.\d+\.\d+\.\d+:\d+$/.test(serial);

interface BulkResult {
  serial: string;
  status: 'fulfilled' | 'rejected';
  message?: string;
}

export const DevicesPage: React.FC = () => {
  const { t } = useTranslation();
  const { devices, selectedSerial, selectDevice, setDevices } = useDeviceStore();
  const [connectOpen, setConnectOpen] = useState(false);
  const [host, setHost] = useState('');
  const [port, setPort] = useState('5555');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [tcpipMessage, setTcpipMessage] = useState('');

  const [selectedSerials, setSelectedSerials] = useState<Set<string>>(new Set());
  const [rebootConfirmOpen, setRebootConfirmOpen] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onlineDevices = devices.filter((d) => d.state === 'device');
  const allOnlineSelected = onlineDevices.length > 0 && onlineDevices.every((d) => selectedSerials.has(d.serial));

  const toggleDevice = (serial: string) => {
    setSelectedSerials((prev) => {
      const next = new Set(prev);
      if (next.has(serial)) {
        next.delete(serial);
      } else {
        next.add(serial);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allOnlineSelected) {
      setSelectedSerials(new Set());
    } else {
      setSelectedSerials(new Set(onlineDevices.map((d) => d.serial)));
    }
  };

  const selectedList = Array.from(selectedSerials);

  const showResults = (results: PromiseSettledResult<any>[], serials: string[]) => {
    const mapped: BulkResult[] = results.map((r, i) => ({
      serial: serials[i],
      status: r.status,
      message: r.status === 'rejected' ? String(r.reason?.message || r.reason) : undefined,
    }));
    setBulkResults(mapped);
    const success = mapped.filter((r) => r.status === 'fulfilled').length;
    setTcpipMessage(t('devices.bulkComplete', { success, total: mapped.length }));
    setTimeout(() => setTcpipMessage(''), 5000);
  };

  const handleBulkInstall = async (file: File) => {
    const serials = [...selectedList];
    setBulkRunning(true);
    setBulkResults(null);
    try {
      const results = await Promise.allSettled(
        serials.map((serial) => installApk(serial, file))
      );
      showResults(results, serials);
    } finally {
      setBulkRunning(false);
    }
  };

  const handleBulkCommand = async () => {
    const cmd = commandInput.trim();
    if (!cmd) return;
    const serials = [...selectedList];
    setBulkRunning(true);
    setBulkResults(null);
    try {
      const results = await Promise.allSettled(
        serials.map((serial) => executeCommand(serial, cmd))
      );
      showResults(results, serials);
    } finally {
      setBulkRunning(false);
      setCommandInput('');
    }
  };

  const handleBulkReboot = async () => {
    setRebootConfirmOpen(false);
    const serials = [...selectedList];
    setBulkRunning(true);
    setBulkResults(null);
    try {
      const results = await Promise.allSettled(
        serials.map((serial) => rebootDevice(serial))
      );
      showResults(results, serials);
    } finally {
      setBulkRunning(false);
    }
  };

  const refreshDevices = async () => {
    const list = await getDevices();
    setDevices(list);
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError('');
    try {
      await connectWireless(host.trim(), Number(port));
      await refreshDevices();
      setConnectOpen(false);
      setHost('');
      setPort('5555');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (address: string) => {
    try {
      await disconnectWireless(address);
      await refreshDevices();
    } catch {
      // ignore
    }
  };

  const handleEnableTcpip = async (serial: string) => {
    try {
      const result = await enableTcpip(serial);
      setTcpipMessage(t('devices.wifiEnabled', { port: 5555 }));
      setTimeout(() => setTcpipMessage(''), 4000);
      if (result.success) {
        await refreshDevices();
      }
    } catch {
      // ignore
    }
  };

  const handleOpenConnect = () => {
    setError('');
    setConnectOpen(true);
  };

  if (devices.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <h2 className="page-title">{t('devices.title')}</h2>
          <Button size="sm" onClick={handleOpenConnect}>
            {t('devices.connectWireless')}
          </Button>
        </div>
        <div className="no-devices">
          <div className="no-devices-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="no-devices-text">{t('devices.noDevices')}</p>

          <div className="instructions">
            <h3>{t('devices.instructions.title')}</h3>
            <ol>
              <li>{t('devices.instructions.step1')}</li>
              <li>{t('devices.instructions.step2')}</li>
              <li>{t('devices.instructions.step3')}</li>
              <li>{t('devices.instructions.step4')}</li>
            </ol>
            <p className="instructions-wifi">{t('devices.instructions.stepWifi')}</p>
          </div>
        </div>

        <Modal
          open={connectOpen}
          title={t('devices.connectWireless')}
          onCancel={() => setConnectOpen(false)}
          onConfirm={handleConnect}
          confirmLabel={connecting ? t('devices.connecting') : t('devices.connectWireless')}
        >
          <div className="wireless-form">
            <label className="wireless-field">
              <span>{t('devices.host')}</span>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.100"
                disabled={connecting}
              />
            </label>
            <label className="wireless-field">
              <span>{t('devices.port')}</span>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="5555"
                disabled={connecting}
              />
            </label>
            {error && <div className="wireless-error">{error}</div>}
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">{t('devices.title')}</h2>
        <Button size="sm" onClick={handleOpenConnect}>
          {t('devices.connectWireless')}
        </Button>
      </div>
      {tcpipMessage && <div className="tcpip-toast">{tcpipMessage}</div>}

      {onlineDevices.length > 0 && (
        <div className="bulk-select-header">
          <label className="bulk-checkbox-label">
            <input
              type="checkbox"
              checked={allOnlineSelected}
              onChange={toggleSelectAll}
            />
            <span>{t('devices.selectAll')}</span>
          </label>
          {selectedSerials.size > 0 && (
            <span className="bulk-selected-count">
              {t('devices.selected', { count: selectedSerials.size })}
            </span>
          )}
        </div>
      )}

      {selectedSerials.size > 0 && (
        <div className="bulk-toolbar">
          <input
            type="file"
            ref={fileInputRef}
            accept=".apk"
            className="bulk-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleBulkInstall(file);
              e.target.value = '';
            }}
          />
          <Button
            size="sm"
            disabled={bulkRunning}
            onClick={() => fileInputRef.current?.click()}
          >
            {t('devices.bulkInstall')}
          </Button>
          <div className="bulk-command-group">
            <input
              type="text"
              className="bulk-command-input"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder={t('devices.commandPlaceholder')}
              disabled={bulkRunning}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleBulkCommand();
              }}
            />
            <Button
              size="sm"
              disabled={bulkRunning || !commandInput.trim()}
              onClick={handleBulkCommand}
            >
              {t('devices.bulkCommand')}
            </Button>
          </div>
          <Button
            size="sm"
            variant="danger"
            disabled={bulkRunning}
            onClick={() => setRebootConfirmOpen(true)}
          >
            {t('devices.bulkReboot')}
          </Button>
          {bulkRunning && (
            <span className="bulk-running-text">
              {t('devices.bulkRunning', { count: selectedSerials.size })}
            </span>
          )}
        </div>
      )}

      {bulkResults && (
        <div className="bulk-results">
          {bulkResults.map((r) => (
            <div key={r.serial} className={`bulk-result-item ${r.status === 'fulfilled' ? 'success' : 'error'}`}>
              <span className="mono">{r.serial}</span>
              <span>{r.status === 'fulfilled' ? t('common.success') : r.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="device-grid">
        {devices.map((device) => (
          <div
            key={device.serial}
            className={`device-card ${device.serial === selectedSerial ? 'selected' : ''} ${selectedSerials.has(device.serial) ? 'bulk-selected' : ''}`}
            onClick={() => selectDevice(device.serial)}
          >
            <div className="device-card-header">
              {device.state === 'device' && (
                <input
                  type="checkbox"
                  className="device-checkbox"
                  checked={selectedSerials.has(device.serial)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleDevice(device.serial);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <div className="device-card-actions">
                <Badge variant={stateVariant[device.state]}>
                  {t(`devices.state.${device.state}`)}
                </Badge>
              </div>
            </div>
            <div className="device-card-body">
              <div className="device-model">{device.model}</div>
              <div className="device-serial mono">{device.serial}</div>
              <div className="device-product">{device.product}</div>
            </div>
            <div className="device-card-footer">
              {isWirelessDevice(device.serial) ? (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDisconnect(device.serial);
                  }}
                >
                  {t('devices.disconnect')}
                </Button>
              ) : (
                device.state === 'device' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEnableTcpip(device.serial);
                    }}
                  >
                    {t('devices.enableWifi')}
                  </Button>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={connectOpen}
        title={t('devices.connectWireless')}
        onCancel={() => setConnectOpen(false)}
        onConfirm={handleConnect}
        confirmLabel={connecting ? t('devices.connecting') : t('devices.connectWireless')}
      >
        <div className="wireless-form">
          <label className="wireless-field">
            <span>{t('devices.host')}</span>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="192.168.1.100"
              disabled={connecting}
            />
          </label>
          <label className="wireless-field">
            <span>{t('devices.port')}</span>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="5555"
              disabled={connecting}
            />
          </label>
          {error && <div className="wireless-error">{error}</div>}
        </div>
      </Modal>

      <Modal
        open={rebootConfirmOpen}
        title={t('devices.bulkReboot')}
        onCancel={() => setRebootConfirmOpen(false)}
        onConfirm={handleBulkReboot}
        confirmVariant="danger"
        confirmLabel={t('devices.bulkReboot')}
      >
        <p>{t('devices.confirmBulkReboot', { count: selectedSerials.size })}</p>
      </Modal>
    </div>
  );
};
