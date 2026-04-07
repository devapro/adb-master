import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { shellSocket } from '../socket/socket-client';
import { uploadScript } from '../api/shell.api';
import { Button } from '../components/common/Button';
import { showToast } from '../components/common/Toast';
import '@xterm/xterm/css/xterm.css';
import './TerminalPage.css';

export const TerminalPage: React.FC = () => {
  const { t } = useTranslation();
  const { serial } = useParams<{ serial: string }>();
  const termRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const [connected, setConnected] = useState(false);
  const [scriptResults, setScriptResults] = useState<string[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!termRef.current) return;

    const theme = getComputedStyle(document.documentElement);
    const term = new Terminal({
      theme: {
        background: theme.getPropertyValue('--color-code-bg').trim() || '#1e2130',
        foreground: theme.getPropertyValue('--color-text-primary').trim() || '#e4e7ec',
        cursor: theme.getPropertyValue('--color-accent').trim() || '#3b82f6',
      },
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 13,
      cursorBlink: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(termRef.current);
    fit.fit();

    termInstance.current = term;
    fitAddon.current = fit;

    term.writeln('ADB Master Terminal');
    term.writeln('==================');
    term.writeln('');

    // Socket setup
    shellSocket.connect();

    shellSocket.on('shell:output', (data: { data: string }) => {
      term.write(data.data);
    });

    shellSocket.on('shell:close', () => {
      term.writeln('\r\n[Session ended]');
      setConnected(false);
    });

    // Send input to server
    term.onData((data) => {
      if (connected) {
        shellSocket.emit('shell:input', { data });
      }
    });

    const handleResize = () => fit.fit();
    window.addEventListener('resize', handleResize);

    // Auto-connect
    if (serial) {
      shellSocket.emit('shell:open', { serial });
      setConnected(true);
      term.writeln(`Connecting to ${serial}...\r\n`);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      shellSocket.emit('shell:close');
      shellSocket.off('shell:output');
      shellSocket.off('shell:close');
      shellSocket.disconnect();
      term.dispose();
    };
  }, [serial]);

  const handleReconnect = () => {
    if (!serial) return;
    termInstance.current?.clear();
    shellSocket.emit('shell:open', { serial });
    setConnected(true);
    termInstance.current?.writeln(`Connecting to ${serial}...\r\n`);
  };

  const handleScriptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !serial) return;

    try {
      const result = await uploadScript(serial, file);
      setScriptResults(result.results);
      showToast(t('common.success'), 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="page terminal-page">
      <div className="terminal-header">
        <h2 className="page-title">{t('terminal.title')}</h2>
        <div className="terminal-actions">
          <span className={`connection-status ${connected ? 'online' : ''}`}>
            {connected ? t('terminal.connected') : t('terminal.disconnected')}
          </span>
          {!connected && (
            <Button size="sm" onClick={handleReconnect}>Reconnect</Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
            {t('terminal.upload')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".sh,.txt"
            onChange={handleScriptUpload}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      <div className="terminal-container" ref={termRef} />

      {scriptResults && (
        <div className="script-results">
          <div className="script-results-header">
            <h3>{t('terminal.scriptResults')}</h3>
            <Button size="sm" variant="ghost" onClick={() => setScriptResults(null)}>
              {t('common.close')}
            </Button>
          </div>
          <pre className="script-output mono">
            {scriptResults.map((r, i) => (
              <div key={i}>{r}</div>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
};
