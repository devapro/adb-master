import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCommandStore } from '../../store/command.store';
import './CommandProgress.css';

export const CommandProgress: React.FC = () => {
  const { t } = useTranslation();
  const pending = useCommandStore((s) => s.pending);
  const startedAt = useCommandStore((s) => s.startedAt);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }
    setElapsed(Date.now() - startedAt);
    const timer = setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 100);
    return () => clearInterval(timer);
  }, [startedAt]);

  if (pending === 0) return null;

  const seconds = (elapsed / 1000).toFixed(1);

  return (
    <div className="command-progress">
      <div className="command-progress-spinner" />
      <span className="command-progress-text">
        {t('command.inProgress')}
      </span>
      <span className="command-progress-time">{seconds}s</span>
    </div>
  );
};
