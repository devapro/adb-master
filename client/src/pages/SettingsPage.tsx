import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listSettings, putSetting, deleteSetting } from '../api/settings.api';
import { Button } from '../components/common/Button';
import { showToast } from '../components/common/Toast';
import { Setting, SettingsNamespace } from '../types';
import './SettingsPage.css';

const NAMESPACES: SettingsNamespace[] = ['system', 'secure', 'global'];

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { serial } = useParams<{ serial: string }>();

  const [namespace, setNamespace] = useState<SettingsNamespace>('system');
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const loadSettings = useCallback(async () => {
    if (!serial) return;
    setLoading(true);
    try {
      const data = await listSettings(serial, namespace);
      setSettings(data);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
    setLoading(false);
  }, [serial, namespace]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handlePut = async (key: string, value: string) => {
    if (!serial) return;
    try {
      await putSetting(serial, namespace, key, value);
      showToast(t('common.success'), 'success');
      setEditingKey(null);
      await loadSettings();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (key: string) => {
    if (!serial) return;
    try {
      await deleteSetting(serial, namespace, key);
      showToast(t('common.success'), 'success');
      await loadSettings();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleAdd = async () => {
    if (!serial || !newKey.trim()) return;
    await handlePut(newKey.trim(), newValue);
    setNewKey('');
    setNewValue('');
  };

  const handleDisableAnimations = async () => {
    if (!serial) return;
    try {
      await putSetting(serial, 'global', 'window_animation_scale', '0');
      await putSetting(serial, 'global', 'transition_animation_scale', '0');
      await putSetting(serial, 'global', 'animator_duration_scale', '0');
      showToast(t('common.success'), 'success');
      if (namespace === 'global') await loadSettings();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleEnableAnimations = async () => {
    if (!serial) return;
    try {
      await putSetting(serial, 'global', 'window_animation_scale', '1.0');
      await putSetting(serial, 'global', 'transition_animation_scale', '1.0');
      await putSetting(serial, 'global', 'animator_duration_scale', '1.0');
      showToast(t('common.success'), 'success');
      if (namespace === 'global') await loadSettings();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleShowTaps = async () => {
    if (!serial) return;
    const current = settings.find((s) => s.key === 'show_touches');
    const newVal = current?.value === '1' ? '0' : '1';
    try {
      await putSetting(serial, 'system', 'show_touches', newVal);
      showToast(t('common.success'), 'success');
      if (namespace === 'system') await loadSettings();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const startEdit = (key: string, value: string) => {
    setEditingKey(key);
    setEditValue(value);
  };

  const filtered = settings.filter(
    (s) =>
      s.key.toLowerCase().includes(search.toLowerCase()) ||
      s.value.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="settings-page">
      <h2>{t('settings.title')}</h2>

      <div className="settings-quick-toggles">
        <h3>{t('settings.quickToggles')}</h3>
        <div className="quick-toggle-row">
          <Button variant="secondary" size="sm" onClick={handleDisableAnimations}>
            {t('settings.disableAnimations')}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleEnableAnimations}>
            {t('settings.enableAnimations')}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleToggleShowTaps}>
            {t('settings.showTaps')}
          </Button>
        </div>
      </div>

      <div className="settings-tabs">
        {NAMESPACES.map((ns) => (
          <button
            key={ns}
            className={`settings-tab ${namespace === ns ? 'active' : ''}`}
            onClick={() => setNamespace(ns)}
          >
            {t(`settings.${ns}`)}
          </button>
        ))}
      </div>

      <div className="settings-toolbar">
        <input
          type="text"
          className="settings-search"
          placeholder={t('settings.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="settings-add-form">
        <input
          type="text"
          className="settings-add-key"
          placeholder={t('settings.key')}
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
        />
        <input
          type="text"
          className="settings-add-value"
          placeholder={t('settings.value')}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button size="sm" onClick={handleAdd} disabled={!newKey.trim()}>
          {t('settings.add')}
        </Button>
      </div>

      <div className="settings-table-wrapper">
        {loading ? (
          <div className="settings-loading">{t('settings.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="settings-empty">{t('settings.noSettings')}</div>
        ) : (
          <table className="settings-table">
            <thead>
              <tr>
                <th>{t('settings.key')}</th>
                <th>{t('settings.value')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.key}>
                  <td className="settings-key">{s.key}</td>
                  <td>
                    {editingKey === s.key ? (
                      <div className="settings-value-edit">
                        <input
                          type="text"
                          className="settings-value-input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handlePut(s.key, editValue);
                            if (e.key === 'Escape') setEditingKey(null);
                          }}
                          autoFocus
                        />
                        <Button size="sm" onClick={() => handlePut(s.key, editValue)}>
                          {t('settings.save')}
                        </Button>
                      </div>
                    ) : (
                      <span
                        className="settings-value"
                        onClick={() => startEdit(s.key, s.value)}
                      >
                        {s.value}
                      </span>
                    )}
                  </td>
                  <td className="settings-actions">
                    {editingKey !== s.key && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(s.key, s.value)}
                        >
                          {t('settings.edit')}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(s.key)}
                        >
                          {t('settings.delete')}
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
