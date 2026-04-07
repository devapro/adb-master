import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDeviceStore } from '../store/device.store';
import { Badge } from '../components/common/Badge';
import './DevicesPage.css';

const stateVariant = {
  device: 'success' as const,
  offline: 'danger' as const,
  unauthorized: 'warning' as const,
  'no permissions': 'danger' as const,
};

export const DevicesPage: React.FC = () => {
  const { t } = useTranslation();
  const { devices, selectedSerial, selectDevice } = useDeviceStore();

  if (devices.length === 0) {
    return (
      <div className="page">
        <h2 className="page-title">{t('devices.title')}</h2>
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
      </div>
    );
  }

  return (
    <div className="page">
      <h2 className="page-title">{t('devices.title')}</h2>
      <div className="device-grid">
        {devices.map((device) => (
          <div
            key={device.serial}
            className={`device-card ${device.serial === selectedSerial ? 'selected' : ''}`}
            onClick={() => selectDevice(device.serial)}
          >
            <div className="device-card-header">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <Badge variant={stateVariant[device.state]}>
                {t(`devices.state.${device.state}`)}
              </Badge>
            </div>
            <div className="device-card-body">
              <div className="device-model">{device.model}</div>
              <div className="device-serial mono">{device.serial}</div>
              <div className="device-product">{device.product}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
