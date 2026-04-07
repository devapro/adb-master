import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { screenSocket } from '../socket/socket-client';
import { sendTap, sendSwipe, sendKeyEvent, sendText } from '../api/input.api';
import { Button } from '../components/common/Button';
import { showToast } from '../components/common/Toast';
import './ScreenPage.css';

const FPS_OPTIONS = [1, 2, 3, 5];

const KEY_BAR: { labelKey: string; code: number }[] = [
  { labelKey: 'input.back', code: 4 },
  { labelKey: 'input.home', code: 3 },
  { labelKey: 'input.recents', code: 187 },
  { labelKey: 'input.volUp', code: 24 },
  { labelKey: 'input.volDown', code: 25 },
];

interface PointerState {
  clientX: number;
  clientY: number;
  deviceX: number;
  deviceY: number;
  time: number;
}

export const ScreenPage: React.FC = () => {
  const { t } = useTranslation();
  const { serial } = useParams<{ serial: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [fps, setFps] = useState(1);
  const [frameCount, setFrameCount] = useState(0);
  const [actualFps, setActualFps] = useState(0);
  const fpsCounterRef = useRef({ count: 0, lastTime: Date.now() });
  const pointerDownRef = useRef<PointerState | null>(null);

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

  // Map canvas client coords → device pixel coords
  const toDeviceCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.round((clientX - rect.left) * (canvas.width / rect.width)),
      y: Math.round((clientY - rect.top) * (canvas.height / rect.height)),
    };
  };

  const SPECIAL_KEYS: Record<string, number> = {
    Backspace: 67,
    Enter: 66,
    Tab: 61,
    Delete: 112,
    Escape: 111,
    ArrowLeft: 21,
    ArrowRight: 22,
    ArrowUp: 19,
    ArrowDown: 20,
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!serial || !streaming) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return; // let browser shortcuts through
    e.preventDefault();
    try {
      if (SPECIAL_KEYS[e.key] !== undefined) {
        await sendKeyEvent(serial, SPECIAL_KEYS[e.key]);
      } else if (e.key.length === 1) {
        await sendText(serial, e.key);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!serial || !streaming) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus(); // grab keyboard focus so keydown events work immediately
    const { x, y } = toDeviceCoords(e.clientX, e.clientY);
    pointerDownRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      deviceX: x,
      deviceY: y,
      time: Date.now(),
    };
  };

  const handlePointerUp = async (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!serial || !streaming || !pointerDownRef.current) return;
    const down = pointerDownRef.current;
    pointerDownRef.current = null;

    const dClient = Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY);
    const duration = Date.now() - down.time;

    try {
      if (dClient < 8) {
        await sendTap(serial, down.deviceX, down.deviceY);
      } else {
        const { x: x2, y: y2 } = toDeviceCoords(e.clientX, e.clientY);
        await sendSwipe(serial, down.deviceX, down.deviceY, x2, y2, duration);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handlePointerCancel = () => {
    pointerDownRef.current = null;
  };

  const handleKeyEvent = async (code: number) => {
    if (!serial) return;
    try {
      await sendKeyEvent(serial, code);
    } catch (err: any) {
      showToast(err.message, 'error');
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
          className={`screen-canvas${streaming ? ' interactive' : ''}`}
          style={{ display: frameCount > 0 ? 'block' : 'none' }}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onKeyDown={handleKeyDown}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      <div className="screen-keybar">
        {KEY_BAR.map(({ labelKey, code }) => (
          <button
            key={code}
            className="screen-key-btn"
            onClick={() => handleKeyEvent(code)}
            disabled={!serial}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
};
