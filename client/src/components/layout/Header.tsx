import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeviceStore } from '../../store/device.store';
import { useThemeStore } from '../../store/theme.store';
import { useLocaleStore } from '../../store/locale.store';
import { useConnectionStore } from '../../store/connection.store';
import { getRelayStatus, RelaySessionInfo } from '../../api/relay.api';
import { ConnectionModal } from '../common/ConnectionModal';
import './Header.css';

export const Header: React.FC = () => {
  const { t } = useTranslation();
  const { devices, selectedSerial, selectDevice } = useDeviceStore();
  const { mode: themeMode, toggle } = useThemeStore();
  const { locale, setLocale } = useLocaleStore();
  const connectionMode = useConnectionStore((s) => s.mode);
  const sessionId = useConnectionStore((s) => s.sessionId);
  const connected = useConnectionStore((s) => s.connected);
  const [modalOpen, setModalOpen] = useState(false);
  const [relayInfo, setRelayInfo] = useState<RelaySessionInfo | null>(null);

  useEffect(() => {
    if (connectionMode === 'local') {
      getRelayStatus().then(setRelayInfo).catch(() => setRelayInfo(null));
    } else {
      setRelayInfo(null);
    }
  }, [connectionMode]);

  return (
    <header className="header">
      <div className="header-left">
        <select
          className="header-select device-select"
          value={selectedSerial || ''}
          onChange={(e) => selectDevice(e.target.value || null)}
        >
          {devices.length === 0 && (
            <option value="">{t('header.noDevice')}</option>
          )}
          {devices.map((d) => (
            <option key={d.serial} value={d.serial}>
              {d.model} ({d.serial}) - {t(`devices.state.${d.state}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="header-right">
        {relayInfo && relayInfo.sessionId && (
          <button className="relay-indicator" onClick={() => setModalOpen(true)}>
            <span className={`relay-indicator-dot ${relayInfo.connected ? 'connected' : 'disconnected'}`} />
            {t('connection.relayActive')}
          </button>
        )}
        <button className="connection-indicator" onClick={() => setModalOpen(true)}>
          <span
            className={`connection-dot ${connectionMode}${connectionMode === 'remote' && !connected ? ' disconnected' : ''}`}
          />
          {connectionMode === 'remote'
            ? `${t('connection.remoteMode')}: ${sessionId}`
            : t('connection.localMode')}
        </button>

        <select
          className="header-select lang-select"
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
        >
          <option value="en">EN</option>
          <option value="ru">RU</option>
        </select>

        <button className="theme-toggle" onClick={toggle} title="Toggle theme">
          {themeMode === 'dark' ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          )}
        </button>
      </div>

      <ConnectionModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </header>
  );
};
