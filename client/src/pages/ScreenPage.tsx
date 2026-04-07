import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { screenSocket } from '../socket/socket-client';
import { Button } from '../components/common/Button';
import { showToast } from '../components/common/Toast';
import './ScreenPage.css';

const FPS_OPTIONS = [1, 2, 3, 5];

export const ScreenPage: React.FC = () => {
  const { t } = useTranslation();
  const { serial } = useParams<{ serial: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [fps, setFps] = useState(1);
  const [frameCount, setFrameCount] = useState(0);
  const [actualFps, setActualFps] = useState(0);
  const fpsCounterRef = useRef({ count: 0, lastTime: Date.now() });

  useEffect(() => {
    screenSocket.connect();

    screenSocket.on('screen:frame', (frame: { data: string; timestamp: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const binary = atob(frame.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/png' });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      img.onload = () => {
        if (canvas.width !== img.naturalWidth) canvas.width = img.naturalWidth;
        if (canvas.height !== img.naturalHeight) canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
      };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;

      const counter = fpsCounterRef.current;
      counter.count++;
      const now = Date.now();
      const elapsed = now - counter.lastTime;
      if (elapsed >= 1000) {
        setActualFps(Math.round((counter.count * 1000) / elapsed));
        counter.count = 0;
        counter.lastTime = now;
      }
      setFrameCount((n) => n + 1);
    });

    screenSocket.on('screen:error', (err: { message: string }) => {
      showToast(err.message, 'error');
      setStreaming(false);
    });

    return () => {
      screenSocket.off('screen:frame');
      screenSocket.off('screen:error');
      screenSocket.emit('screen:stop');
      screenSocket.disconnect();
    };
  }, []);

  const handleStart = () => {
    if (!serial) return;
    setFrameCount(0);
    setActualFps(0);
    fpsCounterRef.current = { count: 0, lastTime: Date.now() };
    screenSocket.emit('screen:start', { serial, fps });
    setStreaming(true);
  };

  const handleStop = () => {
    screenSocket.emit('screen:stop');
    setStreaming(false);
  };

  const handleFpsChange = (newFps: number) => {
    setFps(newFps);
    if (streaming && serial) {
      screenSocket.emit('screen:start', { serial, fps: newFps });
    }
  };

  return (
    <div className="page screen-page">
      <h2 className="page-title">{t('screen.title')}</h2>

      <div className="screen-toolbar">
        <div className="screen-fps-group">
          <span className="screen-fps-label">{t('screen.fps')}:</span>
          {FPS_OPTIONS.map((f) => (
            <button
              key={f}
              className={`screen-fps-btn${fps === f ? ' active' : ''}`}
              onClick={() => handleFpsChange(f)}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="screen-actions">
          {!streaming ? (
            <Button onClick={handleStart}>{t('screen.start')}</Button>
          ) : (
            <Button variant="danger" onClick={handleStop}>{t('screen.stop')}</Button>
          )}
        </div>

        {streaming && (
          <div className="screen-stats">
            <span className="screen-stat mono">{frameCount} {t('screen.frames')}</span>
            <span className="screen-stat mono">{actualFps} fps</span>
          </div>
        )}
      </div>

      <div className="screen-canvas-wrapper">
        {frameCount === 0 && (
          <div className="screen-placeholder">
            {streaming ? t('screen.waiting') : t('screen.placeholder')}
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="screen-canvas"
          style={{ display: frameCount > 0 ? 'block' : 'none' }}
        />
      </div>
    </div>
  );
};
