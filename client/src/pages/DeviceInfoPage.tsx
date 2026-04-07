import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DeviceInfo, IntentExtra, IntentResult } from '../types';
import { getDeviceInfo, captureBugreport, rebootDevice } from '../api/device-info.api';
import {
  captureScreenshot,
  startRecording,
  stopRecording,
  getRecordingStatus,
  downloadRecording,
} from '../api/screen.api';
import { sendIntent } from '../api/intent.api';
import { Spinner } from '../components/common/Spinner';
import { Modal } from '../components/common/Modal';
import { showToast } from '../components/common/Toast';
import './DeviceInfoPage.css';

function getBatteryBarClass(level: number): string {
  if (level > 50) return 'success';
  if (level > 20) return 'warning';
  return 'danger';
}

export const DeviceInfoPage: React.FC = () => {
  const { t } = useTranslation();
  const { serial } = useParams<{ serial: string }>();
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [recordingReady, setRecordingReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [capturingBugreport, setCapturingBugreport] = useState(false);

  const [rebootModal, setRebootModal] = useState<'system' | 'recovery' | 'bootloader' | null>(null);
  const [rebooting, setRebooting] = useState(false);

  const [intentOpen, setIntentOpen] = useState(false);
  const [intentAction, setIntentAction] = useState('');
  const [intentData, setIntentData] = useState('');
  const [intentComponent, setIntentComponent] = useState('');
  const [intentCategory, setIntentCategory] = useState('');
  const [intentExtras, setIntentExtras] = useState<IntentExtra[]>([]);
  const [intentFlags, setIntentFlags] = useState('');
  const [intentSending, setIntentSending] = useState(false);
  const [intentResult, setIntentResult] = useState<IntentResult | null>(null);

  useEffect(() => {
    if (!serial) return;
    setLoading(true);
    getDeviceInfo(serial)
      .then(setInfo)
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [serial]);

  useEffect(() => {
    if (!serial) return;
    getRecordingStatus(serial).then((active) => {
      if (active) {
        setRecording(true);
        setRecordingReady(false);
      }
    });
  }, [serial]);

  useEffect(() => {
    if (recording) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recording]);

  const handleStartRecording = useCallback(() => {
    if (!serial || recording || stopping) return;
    startRecording(serial)
      .then(() => {
        setRecording(true);
        setRecordingReady(false);
      })
      .catch((err) => showToast(err.message, 'error'));
  }, [serial, recording, stopping]);

  const handleStopRecording = useCallback(() => {
    if (!serial || !recording || stopping) return;
    setStopping(true);
    stopRecording(serial)
      .then(() => {
        setRecording(false);
        setRecordingReady(true);
      })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setStopping(false));
  }, [serial, recording, stopping]);

  const handleDownloadRecording = useCallback(() => {
    if (!serial) return;
    downloadRecording(serial)
      .then(() => setRecordingReady(false))
      .catch((err) => showToast(err.message, 'error'));
  }, [serial]);

  const handleCapture = useCallback(() => {
    if (!serial || capturing) return;
    setCapturing(true);
    captureScreenshot(serial)
      .then((url) => {
        if (screenshotUrl) URL.revokeObjectURL(screenshotUrl);
        setScreenshotUrl(url);
      })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setCapturing(false));
  }, [serial, capturing, screenshotUrl]);

  const handleDownload = useCallback(() => {
    if (!screenshotUrl) return;
    const a = document.createElement('a');
    a.href = screenshotUrl;
    a.download = `screenshot_${serial}_${Date.now()}.png`;
    a.click();
  }, [screenshotUrl, serial]);

  const handleCaptureBugreport = useCallback(() => {
    if (!serial || capturingBugreport) return;
    setCapturingBugreport(true);
    captureBugreport(serial)
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setCapturingBugreport(false));
  }, [serial, capturingBugreport]);

  const handleReboot = useCallback(() => {
    if (!serial || !rebootModal || rebooting) return;
    setRebooting(true);
    rebootDevice(serial, rebootModal)
      .then(() => {
        showToast(t('deviceInfo.rebootStarted'), 'success');
        setRebootModal(null);
      })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setRebooting(false));
  }, [serial, rebootModal, rebooting, t]);

  const handleAddExtra = useCallback(() => {
    setIntentExtras((prev) => [...prev, { type: 'string', key: '', value: '' }]);
  }, []);

  const handleRemoveExtra = useCallback((index: number) => {
    setIntentExtras((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleExtraChange = useCallback(
    (index: number, field: keyof IntentExtra, value: string) => {
      setIntentExtras((prev) =>
        prev.map((e, i) => (i === index ? { ...e, [field]: value } : e))
      );
    },
    []
  );

  const handleSendIntent = useCallback(() => {
    if (!serial || intentSending) return;
    if (!intentAction && !intentData && !intentComponent) {
      showToast(t('intent.noParams'), 'error');
      return;
    }
    setIntentSending(true);
    setIntentResult(null);
    sendIntent(serial, {
      action: intentAction || undefined,
      data: intentData || undefined,
      component: intentComponent || undefined,
      category: intentCategory || undefined,
      extras: intentExtras.length > 0 ? intentExtras : undefined,
      flags: intentFlags || undefined,
    })
      .then((result) => {
        setIntentResult(result);
        if (result.success) showToast(t('intent.success'), 'success');
      })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setIntentSending(false));
  }, [
    serial,
    intentSending,
    intentAction,
    intentData,
    intentComponent,
    intentCategory,
    intentExtras,
    intentFlags,
    t,
  ]);

  if (loading) {
    return (
      <div className="page loading-page">
        <Spinner size={32} />
        <p>{t('deviceInfo.loading')}</p>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="page">
        <h2 className="page-title">{t('deviceInfo.title')}</h2>
        <div className="empty-state">{t('common.error')}</div>
      </div>
    );
  }

  const memoryPercent = info.memory.totalMB > 0
    ? Math.round((info.memory.usedMB / info.memory.totalMB) * 100)
    : 0;

  return (
    <div className="page">
      <h2 className="page-title">{t('deviceInfo.title')}</h2>

      <div className="device-info-grid">
        <div className="info-card">
          <h3>{t('deviceInfo.device')}</h3>
          <div className="info-row">
            <span className="info-label">{t('deviceInfo.model')}</span>
            <span className="info-value">{info.model}</span>
          </div>
          <div className="info-row">
            <span className="info-label">{t('deviceInfo.manufacturer')}</span>
            <span className="info-value">{info.manufacturer}</span>
          </div>
          <div className="info-row">
            <span className="info-label">{t('deviceInfo.brand')}</span>
            <span className="info-value">{info.brand}</span>
          </div>
          <div className="info-row">
            <span className="info-label">{t('deviceInfo.androidVersion')}</span>
            <span className="info-value">{info.androidVersion}</span>
          </div>
          <div className="info-row">
            <span className="info-label">{t('deviceInfo.sdk')}</span>
            <span className="info-value">{info.sdkVersion}</span>
          </div>
          <div className="info-row">
            <span className="info-label">{t('deviceInfo.build')}</span>
            <span className="info-value">{info.buildNumber}</span>
          </div>
          <div className="info-row">
            <span className="info-label">{t('deviceInfo.serial')}</span>
            <span className="info-value">{info.serialNumber}</span>
          </div>
        </div>

        <div className="info-card">
          <h3>{t('deviceInfo.battery')}</h3>
          <div className="info-bar-container">
            <div className="info-bar">
              <div
                className={`info-bar-fill ${getBatteryBarClass(info.battery.level)}`}
                style={{ width: `${info.battery.level}%` }}
              />
            </div>
            <span className="info-bar-percent">{info.battery.level}%</span>
          </div>
          <div className="info-row">
            <span className="info-label">{t('deviceInfo.batteryStatus')}</span>
            <span className="info-value">{info.battery.status}</span>
          </div>
          <div className="info-row">
            <span className="info-label">{t('deviceInfo.batteryTemp')}</span>
            <span className="info-value">{info.battery.temperature}°C</span>
          </div>
          <div className="info-row">
            <span className="info-label">{t('deviceInfo.batteryHealth')}</span>
            <span className="info-value">{info.battery.health}</span>
          </div>
        </div>

        <div className="info-card">
          <h3>{t('deviceInfo.memory')}</h3>
          <div className="info-bar-container">
            <div className="info-bar">
              <div
                className="info-bar-fill accent"
                style={{ width: `${memoryPercent}%` }}
              />
            </div>
            <span className="info-bar-percent">{memoryPercent}%</span>
          </div>
          <div className="info-stats">
            <span>{t('deviceInfo.memUsed')}: <strong className="mono">{info.memory.usedMB} MB</strong></span>
            <span>{t('deviceInfo.memFree')}: <strong className="mono">{info.memory.freeMB} MB</strong></span>
            <span>{t('deviceInfo.memTotal')}: <strong className="mono">{info.memory.totalMB} MB</strong></span>
          </div>
        </div>

        <div className="info-card">
          <h3>{t('deviceInfo.cpu')}</h3>
          <div className="info-row">
            <span className="info-label">{t('deviceInfo.cpuProcessor')}</span>
            <span className="info-value">{info.cpu.processor}</span>
          </div>
          <div className="info-row">
            <span className="info-label">{t('deviceInfo.cpuCores')}</span>
            <span className="info-value">{info.cpu.cores}</span>
          </div>
          <div className="info-row">
            <span className="info-label">{t('deviceInfo.cpuUsage')}</span>
            <span className="info-value">{info.cpu.usage}%</span>
          </div>
        </div>

        <div className="info-card">
          <h3>{t('deviceInfo.screen')}</h3>
          <div className="info-row">
            <span className="info-label">{t('deviceInfo.resolution')}</span>
            <span className="info-value">{info.screenResolution}</span>
          </div>
          <div className="info-row">
            <span className="info-label">{t('deviceInfo.density')}</span>
            <span className="info-value">{info.screenDensity} dpi</span>
          </div>
        </div>

        <div className="info-card screenshot-card">
          <h3>{t('deviceInfo.screenshot')}</h3>
          <div className="screenshot-actions">
            <button
              className="screenshot-btn"
              onClick={handleCapture}
              disabled={capturing}
            >
              {capturing ? t('common.loading') : t('deviceInfo.captureScreenshot')}
            </button>
            {screenshotUrl && (
              <button className="screenshot-btn secondary" onClick={handleDownload}>
                {t('deviceInfo.download')}
              </button>
            )}
          </div>
          {capturing && (
            <div className="screenshot-loading">
              <Spinner size={24} />
            </div>
          )}
          {screenshotUrl && !capturing && (
            <div className="screenshot-preview">
              <img src={screenshotUrl} alt={t('deviceInfo.screenshot')} />
            </div>
          )}
        </div>

        <div className="info-card recording-card">
          <h3>{t('deviceInfo.recording')}</h3>
          <div className="recording-actions">
            {!recording ? (
              <button
                className="screenshot-btn"
                onClick={handleStartRecording}
                disabled={stopping}
              >
                {t('deviceInfo.startRecording')}
              </button>
            ) : (
              <button
                className="screenshot-btn danger"
                onClick={handleStopRecording}
                disabled={stopping}
              >
                {stopping
                  ? t('deviceInfo.recordingStopping')
                  : t('deviceInfo.stopRecording')}
              </button>
            )}
            {recordingReady && !recording && (
              <button
                className="screenshot-btn secondary"
                onClick={handleDownloadRecording}
              >
                {t('deviceInfo.downloadRecording')}
              </button>
            )}
          </div>
          {recording && (
            <div className="recording-status">
              <span className="recording-indicator" />
              <span className="recording-text">
                {t('deviceInfo.recordingInProgress')}
              </span>
              <span className="recording-timer mono">
                {Math.floor(elapsed / 60)
                  .toString()
                  .padStart(2, '0')}
                :{(elapsed % 60).toString().padStart(2, '0')}
              </span>
            </div>
          )}
        </div>

        <div className="info-card">
          <h3>{t('deviceInfo.bugreport')}</h3>
          <div className="screenshot-actions">
            <button
              className="screenshot-btn"
              onClick={handleCaptureBugreport}
              disabled={capturingBugreport}
            >
              {capturingBugreport
                ? t('deviceInfo.capturingBugreport')
                : t('deviceInfo.captureBugreport')}
            </button>
          </div>
          {capturingBugreport && (
            <div className="screenshot-loading">
              <Spinner size={24} />
            </div>
          )}
        </div>

        <div className="info-card reboot-card">
          <h3>{t('deviceInfo.reboot')}</h3>
          <div className="reboot-actions">
            <button
              className="screenshot-btn danger"
              onClick={() => setRebootModal('system')}
              disabled={rebooting}
            >
              {t('deviceInfo.rebootSystem')}
            </button>
            <button
              className="screenshot-btn secondary"
              onClick={() => setRebootModal('recovery')}
              disabled={rebooting}
            >
              {t('deviceInfo.rebootRecovery')}
            </button>
            <button
              className="screenshot-btn secondary"
              onClick={() => setRebootModal('bootloader')}
              disabled={rebooting}
            >
              {t('deviceInfo.rebootBootloader')}
            </button>
          </div>
        </div>

        <div className="info-card intent-card">
          <h3
            className="intent-header"
            onClick={() => setIntentOpen((v) => !v)}
          >
            <span>{t('intent.title')}</span>
            <span className={`intent-chevron ${intentOpen ? 'open' : ''}`}>&#9662;</span>
          </h3>
          {intentOpen && (
            <div className="intent-form">
              <div className="intent-field">
                <label>{t('intent.action')}</label>
                <input
                  type="text"
                  placeholder="android.intent.action.VIEW"
                  value={intentAction}
                  onChange={(e) => setIntentAction(e.target.value)}
                />
              </div>
              <div className="intent-field">
                <label>{t('intent.data')}</label>
                <input
                  type="text"
                  placeholder="https://example.com"
                  value={intentData}
                  onChange={(e) => setIntentData(e.target.value)}
                />
              </div>
              <div className="intent-field">
                <label>{t('intent.component')}</label>
                <input
                  type="text"
                  placeholder="com.example/.MainActivity"
                  value={intentComponent}
                  onChange={(e) => setIntentComponent(e.target.value)}
                />
              </div>
              <div className="intent-field">
                <label>{t('intent.category')}</label>
                <input
                  type="text"
                  placeholder="android.intent.category.DEFAULT"
                  value={intentCategory}
                  onChange={(e) => setIntentCategory(e.target.value)}
                />
              </div>
              <div className="intent-field">
                <label>{t('intent.extras')}</label>
                {intentExtras.map((extra, idx) => (
                  <div key={idx} className="intent-extra-row">
                    <select
                      value={extra.type}
                      onChange={(e) => handleExtraChange(idx, 'type', e.target.value)}
                    >
                      <option value="string">string</option>
                      <option value="int">int</option>
                      <option value="bool">bool</option>
                      <option value="float">float</option>
                      <option value="long">long</option>
                    </select>
                    <input
                      type="text"
                      placeholder={t('intent.key')}
                      value={extra.key}
                      onChange={(e) => handleExtraChange(idx, 'key', e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder={t('intent.value')}
                      value={extra.value}
                      onChange={(e) => handleExtraChange(idx, 'value', e.target.value)}
                    />
                    <button
                      className="intent-remove-btn"
                      onClick={() => handleRemoveExtra(idx)}
                    >
                      &times;
                    </button>
                  </div>
                ))}
                <button className="screenshot-btn secondary" onClick={handleAddExtra}>
                  {t('intent.addExtra')}
                </button>
              </div>
              <div className="intent-field">
                <label>{t('intent.flags')}</label>
                <input
                  type="text"
                  value={intentFlags}
                  onChange={(e) => setIntentFlags(e.target.value)}
                />
              </div>
              <button
                className="screenshot-btn"
                onClick={handleSendIntent}
                disabled={intentSending}
              >
                {intentSending ? t('common.loading') : t('intent.send')}
              </button>
              {intentResult && (
                <div className="intent-output">
                  <label>{t('intent.output')}</label>
                  <pre className="intent-output-text">{intentResult.output}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={rebootModal !== null}
        title={t('deviceInfo.reboot')}
        onCancel={() => setRebootModal(null)}
        onConfirm={handleReboot}
        confirmVariant="danger"
      >
        <p>
          {rebootModal === 'recovery'
            ? t('deviceInfo.confirmRecovery')
            : rebootModal === 'bootloader'
              ? t('deviceInfo.confirmBootloader')
              : t('deviceInfo.confirmReboot')}
        </p>
      </Modal>
    </div>
  );
};
