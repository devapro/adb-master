import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WifiStatus, ProxySettings, PortForwardList } from '../types';
import { getWifi, setWifi, getProxy, setProxy, clearProxy } from '../api/network.api';
import { listPorts, addForward, removeForward, addReverse, removeReverse } from '../api/ports.api';
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
  const [ports, setPorts] = useState<PortForwardList>({ forwards: [], reverses: [] });
  const [forwardForm, setForwardForm] = useState({ localPort: '', remotePort: '' });
  const [reverseForm, setReverseForm] = useState({ localPort: '', remotePort: '' });
  const [loading, setLoading] = useState(true);

  const fetchPorts = async () => {
    if (!serial) return;
    try {
      const data = await listPorts(serial);
      setPorts(data);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

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
    fetchPorts();
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

  const handleAddForward = async () => {
    if (!serial) return;
    const local = parseInt(forwardForm.localPort, 10);
    const remote = parseInt(forwardForm.remotePort, 10);
    if (!local || !remote || local < 1 || local > 65535 || remote < 1 || remote > 65535) {
      showToast('Invalid port', 'error');
      return;
    }
    try {
      await addForward(serial, local, remote);
      showToast(t('common.success'), 'success');
      setForwardForm({ localPort: '', remotePort: '' });
      fetchPorts();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleRemoveForward = async (localPort: number) => {
    if (!serial) return;
    try {
      await removeForward(serial, localPort);
      showToast(t('common.success'), 'success');
      fetchPorts();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleAddReverse = async () => {
    if (!serial) return;
    const local = parseInt(reverseForm.localPort, 10);
    const remote = parseInt(reverseForm.remotePort, 10);
    if (!local || !remote || local < 1 || local > 65535 || remote < 1 || remote > 65535) {
      showToast('Invalid port', 'error');
      return;
    }
    try {
      await addReverse(serial, local, remote);
      showToast(t('common.success'), 'success');
      setReverseForm({ localPort: '', remotePort: '' });
      fetchPorts();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleRemoveReverse = async (remotePort: number) => {
    if (!serial) return;
    try {
      await removeReverse(serial, remotePort);
      showToast(t('common.success'), 'success');
      fetchPorts();
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

      <div className="port-forwarding-section">
        <h3>{t('network.ports.title')}</h3>

        <div className="network-grid">
          <div className="network-card">
            <h3>{t('network.ports.forward')}</h3>
            {ports.forwards.length === 0 ? (
              <p className="port-empty">{t('network.ports.noForwards')}</p>
            ) : (
              <table className="port-table">
                <thead>
                  <tr>
                    <th>{t('network.ports.localPort')}</th>
                    <th />
                    <th>{t('network.ports.remotePort')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {ports.forwards.map((f) => (
                    <tr key={f.localPort}>
                      <td className="mono">{f.localPort}</td>
                      <td className="port-arrow">&rarr;</td>
                      <td className="mono">{f.remotePort}</td>
                      <td>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleRemoveForward(f.localPort)}
                        >
                          {t('network.ports.remove')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="port-add-form">
              <input
                type="number"
                value={forwardForm.localPort}
                onChange={(e) => setForwardForm((f) => ({ ...f, localPort: e.target.value }))}
                placeholder={t('network.ports.localPort')}
                className="form-input"
                min={1}
                max={65535}
              />
              <span className="port-arrow">&rarr;</span>
              <input
                type="number"
                value={forwardForm.remotePort}
                onChange={(e) => setForwardForm((f) => ({ ...f, remotePort: e.target.value }))}
                placeholder={t('network.ports.remotePort')}
                className="form-input"
                min={1}
                max={65535}
              />
              <Button onClick={handleAddForward}>{t('network.ports.addForward')}</Button>
            </div>
          </div>

          <div className="network-card">
            <h3>{t('network.ports.reverse')}</h3>
            {ports.reverses.length === 0 ? (
              <p className="port-empty">{t('network.ports.noReverses')}</p>
            ) : (
              <table className="port-table">
                <thead>
                  <tr>
                    <th>{t('network.ports.remotePort')}</th>
                    <th />
                    <th>{t('network.ports.localPort')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {ports.reverses.map((r) => (
                    <tr key={r.remotePort}>
                      <td className="mono">{r.remotePort}</td>
                      <td className="port-arrow">&rarr;</td>
                      <td className="mono">{r.localPort}</td>
                      <td>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleRemoveReverse(r.remotePort)}
                        >
                          {t('network.ports.remove')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="port-add-form">
              <input
                type="number"
                value={reverseForm.remotePort}
                onChange={(e) => setReverseForm((f) => ({ ...f, remotePort: e.target.value }))}
                placeholder={t('network.ports.remotePort')}
                className="form-input"
                min={1}
                max={65535}
              />
              <span className="port-arrow">&rarr;</span>
              <input
                type="number"
                value={reverseForm.localPort}
                onChange={(e) => setReverseForm((f) => ({ ...f, localPort: e.target.value }))}
                placeholder={t('network.ports.localPort')}
                className="form-input"
                min={1}
                max={65535}
              />
              <Button onClick={handleAddReverse}>{t('network.ports.addReverse')}</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
