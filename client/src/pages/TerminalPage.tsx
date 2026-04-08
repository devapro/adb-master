import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { shellSocket } from '../socket/socket-client';
import { useConnectionStore } from '../store/connection.store';
import { uploadScript, openShellSession, pollShellSession, sendShellInput, closeShellSession } from '../api/shell.api';
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
  const isRemote = useConnectionStore((s) => s.mode) === 'remote';
  const pollActiveRef = useRef(false);

  // Create terminal + start polling or socket depending on mode
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

    const handleResize = () => fit.fit();
    window.addEventListener('resize', handleResize);

    if (isRemote) {
      // --- HTTP polling mode (relay) ---
      term.onData((data) => {
        if (serial && pollActiveRef.current) {
          sendShellInput(serial, data).catch(() => {});
        }
      });

      if (serial) {
        term.writeln(`Connecting to ${serial}...\r\n`);
        pollActiveRef.current = true;
        let active = true;

        openShellSession(serial)
          .then(() => {
            setConnected(true);
            const poll = async () => {
              while (active && pollActiveRef.current) {
                try {
                  const res = await pollShellSession(serial);
                  if (!active) break;
                  if (res.output) term.write(res.output);
                  if (!res.active) {
                    term.writeln('\r\n[Session ended]');
                    setConnected(false);
                    pollActiveRef.current = false;
                    break;
                  }
                } catch {
                  if (!active) break;
                }
                await new Promise((r) => setTimeout(r, 500));
              }
            };
            poll();
          })
          .catch((err) => {
            term.writeln(`\r\nFailed to connect: ${err.message}\r\n`);
          });

        return () => {
          active = false;
          pollActiveRef.current = false;
          window.removeEventListener('resize', handleResize);
          closeShellSession(serial).catch(() => {});
          term.dispose();
        };
      }

      return () => {
        window.removeEventListener('resize', handleResize);
        term.dispose();
      };
    }

    // --- Socket.IO mode (local) ---
    shellSocket.connect();

    shellSocket.on('shell:output', (data: { data: string }) => {
      term.write(data.data);
    });

    shellSocket.on('shell:close', () => {
      term.writeln('\r\n[Session ended]');
      setConnected(false);
    });

    term.onData((data) => {
      if (connected) {
        shellSocket.emit('shell:input', { data });
      }
    });

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
  }, [serial, isRemote]);

  const handleReconnect = async () => {
    if (!serial) return;
    termInstance.current?.clear();

    if (isRemote) {
      pollActiveRef.current = true;
      try {
        await openShellSession(serial);
        setConnected(true);
        termInstance.current?.writeln(`Connecting to ${serial}...\r\n`);

        const poll = async () => {
          while (pollActiveRef.current) {
            try {
              const res = await pollShellSession(serial);
              if (res.output) termInstance.current?.write(res.output);
              if (!res.active) {
                termInstance.current?.writeln('\r\n[Session ended]');
                setConnected(false);
                pollActiveRef.current = false;
                break;
              }
            } catch { break; }
            await new Promise((r) => setTimeout(r, 500));
          }
        };
        poll();
      } catch (err: any) {
        termInstance.current?.writeln(`\r\nFailed to connect: ${err.message}\r\n`);
      }
    } else {
      shellSocket.emit('shell:open', { serial });
      setConnected(true);
      termInstance.current?.writeln(`Connecting to ${serial}...\r\n`);
    }
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
