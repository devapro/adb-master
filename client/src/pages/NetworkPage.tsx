import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WifiStatus, ProxySettings } from '../types';
import { getWifi, setWifi, getProxy, setProxy, clearProxy } from '../api/network.api';
import { Button } from '../components/common/Button';
import { Spinner } from '../components/common/Spinner';
import { showToast } from '../components/common/Toast';
import './NetworkPage.css';

export const NetworkPage: React.FC = () => {
  const { t } = useTranslation();
  const { serial } = useParams<{ serial: string }>();
  const [wifi, setWifiState] = useState<WifiStatus | null>(null);
  const [proxy, setProxyState] = useState<ProxySettings | null>(null);
  const [proxyForm, setProxyForm] = useState({ host: '', port: '', bypass: '' });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!serial) return;
    setLoading(true);
    try {
      const [wifiData, proxyData] = await Promise.all([getWifi(serial), getProxy(serial)]);
      setWifiState(wifiData);
      setProxyState(proxyData);
      if (proxyData) {
        setProxyForm({
          host: proxyData.host,
          port: proxyData.port.toString(),
          bypass: proxyData.bypass || '',
        });
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [serial]);

  const handleWifiToggle = async () => {
    if (!serial || !wifi) return;
    try {
      await setWifi(serial, !wifi.enabled);
      showToast(t('common.success'), 'success');
      setTimeout(fetchData, 1500);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSetProxy = async () => {
    if (!serial) return;
    const port = parseInt(proxyForm.port, 10);
    if (!proxyForm.host || !port || port < 1 || port > 65535) {
      showToast('Invalid proxy settings', 'error');
      return;
    }
    try {
      await setProxy(serial, { host: proxyForm.host, port, bypass: proxyForm.bypass || undefined });
      showToast(t('common.success'), 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleClearProxy = async () => {
    if (!serial) return;
    try {
      await clearProxy(serial);
      showToast(t('common.success'), 'success');
      setProxyState(null);
      setProxyForm({ host: '', port: '', bypass: '' });
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="page loading-page">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="page">
      <h2 className="page-title">{t('network.title')}</h2>

      <div className="network-grid">
        <div className="network-card">
          <h3>{t('network.wifi.title')}</h3>
          <div className="wifi-status">
            <label className="toggle-switch">
              <input type="checkbox" checked={wifi?.enabled ?? false} onChange={handleWifiToggle} />
              <span className="toggle-slider" />
            </label>
            <span>{wifi?.enabled ? t('network.wifi.enabled') : t('network.wifi.disabled')}</span>
          </div>
          {wifi?.enabled && (
            <div className="wifi-details">
              {wifi.ssid && (
                <div className="detail-row">
                  <span>{t('network.wifi.ssid')}:</span>
                  <span className="mono">{wifi.ssid}</span>
                </div>
              )}
              {wifi.ipAddress && (
                <div className="detail-row">
                  <span>{t('network.wifi.ip')}:</span>
                  <span className="mono">{wifi.ipAddress}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="network-card">
          <h3>{t('network.proxy.title')}</h3>

          {proxy && (
            <div className="proxy-current">
              <span className="proxy-label">{t('network.proxy.current')}:</span>
              <span className="mono">{proxy.host}:{proxy.port}</span>
            </div>
          )}

          <div className="proxy-form">
            <div className="form-row">
              <label>{t('network.proxy.host')}</label>
              <input
                type="text"
                value={proxyForm.host}
                onChange={(e) => setProxyForm((f) => ({ ...f, host: e.target.value }))}
                placeholder="192.168.1.100"
                className="form-input"
              />
            </div>
            <div className="form-row">
              <label>{t('network.proxy.port')}</label>
              <input
                type="number"
                value={proxyForm.port}
                onChange={(e) => setProxyForm((f) => ({ ...f, port: e.target.value }))}
                placeholder="8080"
                className="form-input"
                min={1}
                max={65535}
              />
            </div>
            <div className="form-row">
              <label>{t('network.proxy.bypass')}</label>
              <input
                type="text"
                value={proxyForm.bypass}
                onChange={(e) => setProxyForm((f) => ({ ...f, bypass: e.target.value }))}
                placeholder="localhost,127.0.0.1"
                className="form-input"
              />
            </div>
            <div className="form-actions">
              <Button onClick={handleSetProxy}>{t('network.proxy.set')}</Button>
              <Button variant="secondary" onClick={handleClearProxy}>
                {t('network.proxy.clear')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
