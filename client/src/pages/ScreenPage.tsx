import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { screenSocket } from '../socket/socket-client';
import { useConnectionStore } from '../store/connection.store';
import { getFrame } from '../api/screen.api';
import * as inputApi from '../api/input.api';
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

function renderFrame(canvas: HTMLCanvasElement, data: ArrayBuffer, renderingRef: React.MutableRefObject<boolean>) {
  if (renderingRef.current) return;
  renderingRef.current = true;
  const blob = new Blob([data], { type: 'image/jpeg' });
  createImageBitmap(blob).then((bitmap) => {
    if (canvas.width !== bitmap.width) canvas.width = bitmap.width;
    if (canvas.height !== bitmap.height) canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(bitmap, 0, 0);
    bitmap.close();
    renderingRef.current = false;
  }).catch(() => {
    renderingRef.current = false;
  });
}

export const ScreenPage: React.FC = () => {
  const { t } = useTranslation();
  const { serial } = useParams<{ serial: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderingRef = useRef(false);
  const [streaming, setStreaming] = useState(false);
  const [fps, setFps] = useState(1);
  const [frameCount, setFrameCount] = useState(0);
  const [actualFps, setActualFps] = useState<number>(0);
  const fpsCounterRef = useRef({ count: 0, lastTime: Date.now() });
  const pointerDownRef = useRef<PointerState | null>(null);
  const isRemote = useConnectionStore((s) => s.mode) === 'remote';

  // Shared FPS counting logic
  const countFrame = useCallback(() => {
    setFrameCount((n) => n + 1);
    const counter = fpsCounterRef.current;
    counter.count++;
    const now = Date.now();
    const elapsed = now - counter.lastTime;
    if (elapsed >= 1000) {
      const raw = (counter.count * 1000) / elapsed;
      setActualFps(raw < 1 ? parseFloat(raw.toFixed(1)) : Math.round(raw));
      counter.count = 0;
      counter.lastTime = now;
    }
  }, []);

  // --- Socket.IO streaming (local mode) ---
  useEffect(() => {
    if (isRemote) return;

    screenSocket.connect();

    screenSocket.on('screen:frame', (data: ArrayBuffer, _timestamp: number) => {
      countFrame();
      const canvas = canvasRef.current;
      if (!canvas) return;
      renderFrame(canvas, data, renderingRef);
    });

    screenSocket.on('screen:error', (err: { message: string }) => {
      showToast(err.message, 'error');
      setStreaming(false);
    });

    screenSocket.on('input:error', (err: { message: string }) => {
      showToast(err.message, 'error');
    });

    return () => {
      screenSocket.off('screen:frame');
      screenSocket.off('screen:error');
      screenSocket.off('input:error');
      screenSocket.emit('screen:stop');
      screenSocket.disconnect();
    };
  }, [isRemote, countFrame]);

  // --- HTTP polling streaming (relay mode) ---
  const streamingRef = useRef(false);
  const fpsRef = useRef(fps);
  fpsRef.current = fps;

  useEffect(() => {
    if (!isRemote) return;
    streamingRef.current = streaming;

    if (!streaming || !serial) return;

    let active = true;

    const poll = async () => {
      while (active && streamingRef.current) {
        const start = Date.now();
        try {
          const data = await getFrame(serial, 70);
          if (!active || !streamingRef.current) break;
          countFrame();
          const canvas = canvasRef.current;
          if (canvas) renderFrame(canvas, data, renderingRef);
        } catch (err: any) {
          if (!active || !streamingRef.current) break;
          showToast(err.message || 'Frame capture failed', 'error');
          setStreaming(false);
          break;
        }
        const elapsed = Date.now() - start;
        const delay = Math.max(0, Math.round(1000 / fpsRef.current) - elapsed);
        if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      }
    };

    poll();

    return () => {
      active = false;
    };
  }, [isRemote, streaming, serial, countFrame]);

  const handleStart = () => {
    if (!serial) return;
    setFrameCount(0);
    setActualFps(0);
    fpsCounterRef.current = { count: 0, lastTime: Date.now() };
    if (!isRemote) {
      screenSocket.emit('screen:start', { serial, fps });
    }
    setStreaming(true);
  };

  const handleStop = () => {
    if (!isRemote) {
      screenSocket.emit('screen:stop');
    }
    setStreaming(false);
  };

  const handleFpsChange = (newFps: number) => {
    setFps(newFps);
    if (streaming && serial && !isRemote) {
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

  // --- Input helpers: socket in local mode, REST in relay mode ---
  const emitTap = (x: number, y: number) => {
    if (!serial) return;
    if (isRemote) {
      inputApi.sendTap(serial, x, y).catch((e) => showToast(e.message, 'error'));
    } else {
      screenSocket.emit('input:tap', { serial, x, y });
    }
  };

  const emitSwipe = (x1: number, y1: number, x2: number, y2: number, duration: number) => {
    if (!serial) return;
    if (isRemote) {
      inputApi.sendSwipe(serial, x1, y1, x2, y2, duration).catch((e) => showToast(e.message, 'error'));
    } else {
      screenSocket.emit('input:swipe', { serial, x1, y1, x2, y2, duration });
    }
  };

  const emitKeyEvent = (keycode: number) => {
    if (!serial) return;
    if (isRemote) {
      inputApi.sendKeyEvent(serial, keycode).catch((e) => showToast(e.message, 'error'));
    } else {
      screenSocket.emit('input:keyevent', { serial, keycode });
    }
  };

  const emitText = (text: string) => {
    if (!serial) return;
    if (isRemote) {
      inputApi.sendText(serial, text).catch((e) => showToast(e.message, 'error'));
    } else {
      screenSocket.emit('input:text', { serial, text });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!serial || !streaming) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    if (SPECIAL_KEYS[e.key] !== undefined) {
      emitKeyEvent(SPECIAL_KEYS[e.key]);
    } else if (e.key.length === 1) {
      emitText(e.key);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!serial || !streaming) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    const { x, y } = toDeviceCoords(e.clientX, e.clientY);
    pointerDownRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      deviceX: x,
      deviceY: y,
      time: Date.now(),
    };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!serial || !streaming || !pointerDownRef.current) return;
    const down = pointerDownRef.current;
    pointerDownRef.current = null;

    const dClient = Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY);
    const duration = Date.now() - down.time;

    if (dClient < 8) {
      emitTap(down.deviceX, down.deviceY);
    } else {
      const { x: x2, y: y2 } = toDeviceCoords(e.clientX, e.clientY);
      emitSwipe(down.deviceX, down.deviceY, x2, y2, duration);
    }
  };

  const handlePointerCancel = () => {
    pointerDownRef.current = null;
  };

  const handleKeyEvent = (code: number) => {
    emitKeyEvent(code);
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
