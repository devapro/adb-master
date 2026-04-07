import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { LogcatLine, LogLevel } from '../types';
import { logcatSocket } from '../socket/socket-client';
import { getSnapshot, clearLogcat } from '../api/logcat.api';
import { Button } from '../components/common/Button';
import { showToast } from '../components/common/Toast';
import './LogcatPage.css';

const LOG_LEVELS: LogLevel[] = ['V', 'D', 'I', 'W', 'E', 'F'];
const LEVEL_COLORS: Record<LogLevel, string> = {
  V: 'var(--color-text-muted)',
  D: 'var(--color-accent)',
  I: 'var(--color-success)',
  W: 'var(--color-warning)',
  E: 'var(--color-danger)',
  F: '#ff0000',
};

export const LogcatPage: React.FC = () => {
  const { t } = useTranslation();
  const { serial } = useParams<{ serial: string }>();
  const [lines, setLines] = useState<LogcatLine[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [levelFilter, setLevelFilter] = useState<LogLevel | ''>('');
  const [tagFilter, setTagFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  useEffect(() => {
    logcatSocket.connect();

    logcatSocket.on('logcat:line', (line: LogcatLine) => {
      setLines((prev) => {
        const next = [...prev, line];
        if (next.length > 10000) return next.slice(-5000);
        return next;
      });
    });

    logcatSocket.on('logcat:error', (data: { message: string }) => {
      showToast(data.message, 'error');
    });

    return () => {
      logcatSocket.off('logcat:line');
      logcatSocket.off('logcat:error');
      logcatSocket.emit('logcat:stop');
      logcatSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (autoScroll && lines.length > 0) {
      virtuosoRef.current?.scrollToIndex({ index: lines.length - 1, behavior: 'smooth' });
    }
  }, [lines.length, autoScroll]);

  const handleStart = () => {
    if (!serial) return;
    setLines([]);
    logcatSocket.emit('logcat:start', {
      serial,
      filters: {
        level: levelFilter || undefined,
        tag: tagFilter || undefined,
      },
    });
    setStreaming(true);
  };

  const handleStop = () => {
    logcatSocket.emit('logcat:stop');
    setStreaming(false);
  };

  const handleClear = async () => {
    if (!serial) return;
    try {
      await clearLogcat(serial);
      setLines([]);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleExport = () => {
    const text = filteredLines.map((l) => l.raw).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logcat-${serial}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadSnapshot = async () => {
    if (!serial) return;
    try {
      const snapshot = await getSnapshot(serial);
      setLines(snapshot);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const filteredLines = lines.filter((line) => {
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      if (!line.message.toLowerCase().includes(q) && !line.tag.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const renderLine = useCallback(
    (index: number) => {
      const line = filteredLines[index];
      return (
        <div className="logcat-line" key={index}>
          <span className="logcat-time mono">{line.timestamp}</span>
          <span className="logcat-pid mono">{line.pid}</span>
          <span className="logcat-level mono" style={{ color: LEVEL_COLORS[line.level] }}>
            {line.level}
          </span>
          <span className="logcat-tag mono">{line.tag}</span>
          <span className="logcat-msg">{line.message}</span>
        </div>
      );
    },
    [filteredLines]
  );

  return (
    <div className="page logcat-page">
      <h2 className="page-title">{t('logcat.title')}</h2>

      <div className="logcat-toolbar">
        <div className="logcat-filters">
          <select
            className="form-input"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as LogLevel | '')}
          >
            <option value="">{t('logcat.filter.all')}</option>
            {LOG_LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          <input
            type="text"
            className="form-input"
            placeholder={t('logcat.filter.tag')}
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          />

          <input
            type="text"
            className="form-input"
            placeholder={t('logcat.filter.search')}
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>

        <div className="logcat-actions">
          {!streaming ? (
            <Button onClick={handleStart}>{t('logcat.start')}</Button>
          ) : (
            <Button variant="danger" onClick={handleStop}>{t('logcat.stop')}</Button>
          )}
          <Button variant="secondary" onClick={handleLoadSnapshot}>Snapshot</Button>
          <Button variant="secondary" onClick={handleClear}>{t('logcat.clear')}</Button>
          <Button variant="secondary" onClick={handleExport}>{t('logcat.export')}</Button>
          <label className="auto-scroll-toggle">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            Auto-scroll
          </label>
        </div>
      </div>

      <div className="logcat-container">
        {filteredLines.length === 0 ? (
          <div className="logcat-empty">{t('logcat.empty')}</div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            totalCount={filteredLines.length}
            itemContent={renderLine}
            followOutput={autoScroll}
            className="logcat-scroller"
          />
        )}
      </div>
    </div>
  );
};
