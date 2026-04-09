import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { screenSocket } from '../socket/socket-client';
import { Button } from '../components/common/Button';
import { showToast } from '../components/common/Toast';
import './ScreenPage.css';

const FPS_OPTIONS = [1, 2, 3, 5];
const QUALITY_OPTIONS = [30, 50, 70, 90];
const SCALE_OPTIONS = [25, 50, 75, 100];

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
  const renderingRef = useRef(false);
  const [streaming, setStreaming] = useState(false);
  const [fps, setFps] = useState(1);
  const [quality, setQuality] = useState(70);
  const [scale, setScale] = useState(100);
  const [frameCount, setFrameCount] = useState(0);
  const [actualFps, setActualFps] = useState<number>(0);
  const fpsCounterRef = useRef({ count: 0, lastTime: Date.now() });
  const pointerDownRef = useRef<PointerState | null>(null);

  useEffect(() => {
    screenSocket.connect();

    screenSocket.on('screen:frame', (data: ArrayBuffer, _timestamp: number) => {
      // FPS counting — always count, even if frame is dropped for rendering
      setFrameCount((n) => n + 1);
      const counter = fpsCounterRef.current;
      counter.count++;
      const now = Date.now();
      const elapsed = now - counter.lastTime;
      if (elapsed >= 1000) {
        const raw = (counter.count * 1000) / elapsed;
        // Show one decimal for sub-1 fps so slow devices don't show "0 fps"
        setActualFps(raw < 1 ? parseFloat(raw.toFixed(1)) : Math.round(raw));
        counter.count = 0;
        counter.lastTime = now;
      }

      // Skip if previous frame is still decoding/rendering
      const canvas = canvasRef.current;
      if (!canvas || renderingRef.current) return;

      renderingRef.current = true;
      // Binary JPEG blob — no base64 decode needed
      const blob = new Blob([data], { type: 'image/jpeg' });

      // Decode off main thread via createImageBitmap
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
  }, []);

  const handleStart = () => {
    if (!serial) return;
    setFrameCount(0);
    setActualFps(0);
    fpsCounterRef.current = { count: 0, lastTime: Date.now() };
    screenSocket.emit('screen:start', { serial, fps, quality, scale });
    setStreaming(true);
  };

  const handleStop = () => {
    screenSocket.emit('screen:stop');
    setStreaming(false);
  };

  const restartStream = (opts: { fps?: number; quality?: number; scale?: number }) => {
    if (streaming && serial) {
      screenSocket.emit('screen:start', {
        serial,
        fps: opts.fps ?? fps,
        quality: opts.quality ?? quality,
        scale: opts.scale ?? scale,
      });
    }
  };

  const handleFpsChange = (newFps: number) => {
    setFps(newFps);
    restartStream({ fps: newFps });
  };

  const handleQualityChange = (newQuality: number) => {
    setQuality(newQuality);
    restartStream({ quality: newQuality });
  };

  const handleScaleChange = (newScale: number) => {
    setScale(newScale);
    restartStream({ scale: newScale });
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!serial || !streaming) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return; // let browser shortcuts through
    e.preventDefault();
    if (SPECIAL_KEYS[e.key] !== undefined) {
      screenSocket.emit('input:keyevent', { serial, keycode: SPECIAL_KEYS[e.key] });
    } else if (e.key.length === 1) {
      screenSocket.emit('input:text', { serial, text: e.key });
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

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!serial || !streaming || !pointerDownRef.current) return;
    const down = pointerDownRef.current;
    pointerDownRef.current = null;

    const dClient = Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY);
    const duration = Date.now() - down.time;

    if (dClient < 8 && duration >= 300) {
      screenSocket.emit('input:longtap', { serial, x: down.deviceX, y: down.deviceY, duration });
    } else if (dClient < 8) {
      screenSocket.emit('input:tap', { serial, x: down.deviceX, y: down.deviceY });
    } else {
      const { x: x2, y: y2 } = toDeviceCoords(e.clientX, e.clientY);
      screenSocket.emit('input:swipe', {
        serial, x1: down.deviceX, y1: down.deviceY, x2, y2, duration,
      });
    }
  };

  const handlePointerCancel = () => {
    pointerDownRef.current = null;
  };

  const handleKeyEvent = (code: number) => {
    if (!serial) return;
    screenSocket.emit('input:keyevent', { serial, keycode: code });
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

        <div className="screen-fps-group">
          <span className="screen-fps-label">{t('screen.quality')}:</span>
          {QUALITY_OPTIONS.map((q) => (
            <button
              key={q}
              className={`screen-fps-btn${quality === q ? ' active' : ''}`}
              onClick={() => handleQualityChange(q)}
            >
              {q}%
            </button>
          ))}
        </div>

        <div className="screen-fps-group">
          <span className="screen-fps-label">{t('screen.scale')}:</span>
          {SCALE_OPTIONS.map((s) => (
            <button
              key={s}
              className={`screen-fps-btn${scale === s ? ' active' : ''}`}
              onClick={() => handleScaleChange(s)}
            >
              {s}%
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
