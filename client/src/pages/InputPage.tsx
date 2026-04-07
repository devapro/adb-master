import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { sendText, sendTap, sendSwipe, sendKeyEvent } from '../api/input.api';
import { Button } from '../components/common/Button';
import { showToast } from '../components/common/Toast';
import './InputPage.css';

const KEY_EVENTS: { key: string; code: number }[] = [
  { key: 'home', code: 3 },
  { key: 'back', code: 4 },
  { key: 'recents', code: 187 },
  { key: 'volUp', code: 24 },
  { key: 'volDown', code: 25 },
  { key: 'power', code: 26 },
  { key: 'enter', code: 66 },
  { key: 'delete', code: 67 },
  { key: 'tab', code: 61 },
  { key: 'playPause', code: 85 },
  { key: 'next', code: 87 },
  { key: 'prev', code: 88 },
];

export const InputPage: React.FC = () => {
  const { t } = useTranslation();
  const { serial } = useParams<{ serial: string }>();

  const [text, setText] = useState('');
  const [tapX, setTapX] = useState('');
  const [tapY, setTapY] = useState('');
  const [swipeX1, setSwipeX1] = useState('');
  const [swipeY1, setSwipeY1] = useState('');
  const [swipeX2, setSwipeX2] = useState('');
  const [swipeY2, setSwipeY2] = useState('');
  const [swipeDuration, setSwipeDuration] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendText = async () => {
    if (!serial || !text.trim()) return;
    setSending(true);
    try {
      await sendText(serial, text);
      showToast(t('common.success'), 'success');
      setText('');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
    setSending(false);
  };

  const handleTap = async () => {
    if (!serial) return;
    const x = Number(tapX);
    const y = Number(tapY);
    if (isNaN(x) || isNaN(y) || x < 0 || y < 0) return;
    setSending(true);
    try {
      await sendTap(serial, x, y);
      showToast(t('common.success'), 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
    setSending(false);
  };

  const handleSwipe = async () => {
    if (!serial) return;
    const x1 = Number(swipeX1);
    const y1 = Number(swipeY1);
    const x2 = Number(swipeX2);
    const y2 = Number(swipeY2);
    const dur = swipeDuration ? Number(swipeDuration) : undefined;
    if ([x1, y1, x2, y2].some((v) => isNaN(v) || v < 0)) return;
    if (dur !== undefined && (isNaN(dur) || dur < 0 || dur > 10000)) return;
    setSending(true);
    try {
      await sendSwipe(serial, x1, y1, x2, y2, dur);
      showToast(t('common.success'), 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
    setSending(false);
  };

  const handleKeyEvent = async (code: number) => {
    if (!serial) return;
    setSending(true);
    try {
      await sendKeyEvent(serial, code);
      showToast(t('common.success'), 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
    setSending(false);
  };

  return (
    <div className="input-page">
      <h2>{t('input.title')}</h2>

      <div className="input-grid">
        <div className="input-card">
          <h3>{t('input.sendText')}</h3>
          <div className="input-form">
            <input
              type="text"
              className="form-input"
              placeholder={t('input.textPlaceholder')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
            />
            <Button onClick={handleSendText} disabled={sending || !text.trim()}>
              {t('input.send')}
            </Button>
          </div>
        </div>

        <div className="input-card">
          <h3>{t('input.tap')}</h3>
          <div className="input-form">
            <div className="coord-row">
              <div className="form-row">
                <label>{t('input.x')}</label>
                <input
                  type="number"
                  className="form-input coord-input"
                  min={0}
                  value={tapX}
                  onChange={(e) => setTapX(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label>{t('input.y')}</label>
                <input
                  type="number"
                  className="form-input coord-input"
                  min={0}
                  value={tapY}
                  onChange={(e) => setTapY(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleTap} disabled={sending || !tapX || !tapY}>
              {t('input.tap')}
            </Button>
          </div>
        </div>

        <div className="input-card">
          <h3>{t('input.swipe')}</h3>
          <div className="input-form">
            <div className="swipe-coords">
              <div className="coord-group">
                <span className="coord-label">{t('input.from')}</span>
                <div className="coord-row">
                  <div className="form-row">
                    <label>{t('input.x')}</label>
                    <input
                      type="number"
                      className="form-input coord-input"
                      min={0}
                      value={swipeX1}
                      onChange={(e) => setSwipeX1(e.target.value)}
                    />
                  </div>
                  <div className="form-row">
                    <label>{t('input.y')}</label>
                    <input
                      type="number"
                      className="form-input coord-input"
                      min={0}
                      value={swipeY1}
                      onChange={(e) => setSwipeY1(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="coord-group">
                <span className="coord-label">{t('input.to')}</span>
                <div className="coord-row">
                  <div className="form-row">
                    <label>{t('input.x')}</label>
                    <input
                      type="number"
                      className="form-input coord-input"
                      min={0}
                      value={swipeX2}
                      onChange={(e) => setSwipeX2(e.target.value)}
                    />
                  </div>
                  <div className="form-row">
                    <label>{t('input.y')}</label>
                    <input
                      type="number"
                      className="form-input coord-input"
                      min={0}
                      value={swipeY2}
                      onChange={(e) => setSwipeY2(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="form-row">
              <label>{t('input.duration')}</label>
              <input
                type="number"
                className="form-input"
                min={0}
                max={10000}
                value={swipeDuration}
                onChange={(e) => setSwipeDuration(e.target.value)}
              />
            </div>
            <Button
              onClick={handleSwipe}
              disabled={sending || !swipeX1 || !swipeY1 || !swipeX2 || !swipeY2}
            >
              {t('input.swipe')}
            </Button>
          </div>
        </div>

        <div className="input-card">
          <h3>{t('input.keyEvents')}</h3>
          <div className="key-grid">
            {KEY_EVENTS.map((ke) => (
              <Button
                key={ke.code}
                variant="secondary"
                size="sm"
                onClick={() => handleKeyEvent(ke.code)}
                disabled={sending}
              >
                {t(`input.${ke.key}`)}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
