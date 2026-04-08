import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useConnectionStore } from '../../store/connection.store';
import { reconnectSockets } from '../../socket/socket-client';
import { getRelayStatus, RelaySessionInfo } from '../../api/relay.api';
import { Button } from './Button';
import './ConnectionModal.css';
import './Modal.css';

interface ConnectionModalProps {
  open: boolean;
  onClose: () => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { mode, relayUrl: storedUrl, sessionId: storedSession, password: storedPassword } =
    useConnectionStore();
  const setRemote = useConnectionStore((s) => s.setRemote);
  const setLocal = useConnectionStore((s) => s.setLocal);
  const setConnected = useConnectionStore((s) => s.setConnected);

  const [tab, setTab] = useState<'local' | 'remote'>(mode);
  const [relayUrl, setRelayUrl] = useState(storedUrl);
  const [sessionId, setSessionId] = useState(storedSession);
  const [password, setPassword] = useState(storedPassword);
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [relayInfo, setRelayInfo] = useState<RelaySessionInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && mode === 'local') {
      getRelayStatus().then(setRelayInfo).catch(() => setRelayInfo(null));
    }
  }, [open, mode]);

  const handleCopyShareUrl = async () => {
    if (!relayInfo?.shareUrl) return;
    try {
      await navigator.clipboard.writeText(relayInfo.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  if (!open) return null;

  const handleConnect = async () => {
    if (!relayUrl || !sessionId) return;

    setStatus('checking');
    setStatusMessage(t('connection.checking'));

    try {
      const url = `${relayUrl.replace(/\/+$/, '')}/relay/sessions/${sessionId}/status`;
      const headers: Record<string, string> = {};
      if (password) {
        headers['x-relay-password'] = password;
      }

      const res = await fetch(url, { headers });
      if (!res.ok) {
        setStatus('error');
        setStatusMessage(t('connection.invalidSession'));
        return;
      }

      const data = await res.json();
      if (!data.agentConnected) {
        setStatus('error');
        setStatusMessage(t('connection.agentOffline'));
        return;
      }

      setRemote(relayUrl.replace(/\/+$/, ''), sessionId, password);
      setConnected(true);
      reconnectSockets();
      setStatus('success');
      setStatusMessage(t('connection.connected'));
      onClose();
    } catch {
      setStatus('error');
      setStatusMessage(t('connection.invalidSession'));
    }
  };

  const handleUseLocal = () => {
    setLocal();
    setConnected(false);
    reconnectSockets();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('connection.title')}</h3>
        </div>
        <div className="modal-body">
          <div className="connection-tabs">
            <button
              className={`connection-tab ${tab === 'local' ? 'active' : ''}`}
              onClick={() => setTab('local')}
            >
              {t('connection.local')}
            </button>
            <button
              className={`connection-tab ${tab === 'remote' ? 'active' : ''}`}
              onClick={() => setTab('remote')}
            >
              {t('connection.remote')}
            </button>
          </div>

          {tab === 'remote' && (
            <div className="connection-form">
              <div className="connection-field">
                <label>{t('connection.relayUrl')}</label>
                <input
                  type="text"
                  value={relayUrl}
                  onChange={(e) => setRelayUrl(e.target.value)}
                  placeholder="https://your-relay.com"
                />
              </div>
              <div className="connection-field">
                <label>{t('connection.sessionId')}</label>
                <input
                  type="text"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  placeholder={t('connection.sessionId')}
                />
              </div>
              <div className="connection-field">
                <label>{t('connection.password')}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('connection.password')}
                />
              </div>
              {status !== 'idle' && (
                <div className={`connection-status ${status}`}>{statusMessage}</div>
              )}
            </div>
          )}

          {tab === 'local' && (
            <div className="connection-local">
              <p>{t('connection.useLocal')}</p>
              {relayInfo && relayInfo.sessionId && (
                <div className="relay-session-info">
                  <h4>{t('connection.relaySession')}</h4>
                  <p className="relay-description">{t('connection.relaySessionInfo')}</p>
                  <div className="relay-details">
                    <div className="relay-status-row">
                      <span className={`relay-status-dot ${relayInfo.connected ? 'connected' : 'disconnected'}`} />
                      <span>{relayInfo.connected ? t('connection.relayConnected') : t('connection.relayDisconnected')}</span>
                      {relayInfo.hasPassword && (
                        <span className="relay-badge">{t('connection.passwordProtected')}</span>
                      )}
                    </div>
                    <div className="relay-share-field">
                      <label>{t('connection.shareUrl')}</label>
                      <div className="relay-share-row">
                        <input type="text" readOnly value={relayInfo.shareUrl || ''} />
                        <button className="relay-copy-btn" onClick={handleCopyShareUrl}>
                          {copied ? t('connection.copied') : t('connection.copy')}
                        </button>
                      </div>
                    </div>
                    <div className="relay-share-field">
                      <label>{t('connection.sessionId')}</label>
                      <input type="text" readOnly value={relayInfo.sessionId || ''} className="mono" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          {tab === 'remote' && (
            <Button onClick={handleConnect} disabled={!relayUrl || !sessionId}>
              {t('connection.connect')}
            </Button>
          )}
          {tab === 'local' && (
            <Button onClick={handleUseLocal}>{t('connection.localMode')}</Button>
          )}
        </div>
      </div>
    </div>
  );
};
