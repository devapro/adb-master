import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppInfo, AppType, AppPermission } from '../types';
import { getApps, uninstallApp, disableApp, stopApp, installApk, clearAppData, clearAppCache, launchApp, extractApk, backupApp, restoreApp, getPermissions, grantPermission, revokePermission } from '../api/apps.api';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { SearchInput } from '../components/common/SearchInput';
import { Spinner } from '../components/common/Spinner';
import { Modal } from '../components/common/Modal';
import { showToast } from '../components/common/Toast';
import './AppsPage.css';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

const typeVariant: Record<AppType, 'danger' | 'info' | 'warning'> = {
  system: 'danger',
  user: 'info',
  preinstalled: 'warning',
};

export const AppsPage: React.FC = () => {
  const { t } = useTranslation();
  const { serial } = useParams<{ serial: string }>();
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [modal, setModal] = useState<{ type: 'remove' | 'disable'; app: AppInfo } | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [permissionsModal, setPermissionsModal] = useState<{ app: AppInfo; permissions: AppPermission[]; loading: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [restoreTarget, setRestoreTarget] = useState<AppInfo | null>(null);

  useEffect(() => {
    if (!serial) return;
    setLoading(true);
    getApps(serial)
      .then(setApps)
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [serial]);

  const filtered = useMemo(() => {
    return apps.filter((app) => {
      if (typeFilter !== 'all' && app.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          app.appName.toLowerCase().includes(q) ||
          app.packageName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [apps, search, typeFilter]);

  const handleAction = async (action: 'remove' | 'disable' | 'stop' | 'clear' | 'clearCache' | 'launch' | 'extractApk' | 'backup' | 'restore', app: AppInfo) => {
    if (!serial) return;
    if (action === 'remove') {
      setModal({ type: 'remove', app });
      return;
    }
    if (action === 'disable') {
      setModal({ type: 'disable', app });
      return;
    }
    if (action === 'restore') {
      setRestoreTarget(app);
      restoreInputRef.current?.click();
      return;
    }
    try {
      if (action === 'backup') {
        showToast(t('apps.backupStarted'), 'success');
        await backupApp(serial, app.packageName);
      } else if (action === 'launch') {
        const result = await launchApp(serial, app.packageName);
        showToast(result.message, result.success ? 'success' : 'error');
      } else if (action === 'clear') {
        const result = await clearAppData(serial, app.packageName);
        showToast(result.message, result.success ? 'success' : 'error');
      } else if (action === 'clearCache') {
        const result = await clearAppCache(serial, app.packageName);
        showToast(result.message, result.success ? 'success' : 'error');
      } else if (action === 'extractApk') {
        await extractApk(serial, app.packageName);
      } else {
        const result = await stopApp(serial, app.packageName);
        showToast(result.message, result.success ? 'success' : 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const confirmAction = async () => {
    if (!serial || !modal) return;
    try {
      const result =
        modal.type === 'remove'
          ? await uninstallApp(serial, modal.app.packageName)
          : await disableApp(serial, modal.app.packageName);
      showToast(result.message, result.success ? 'success' : 'error');
      if (result.success) {
        setApps((prev) => prev.filter((a) => a.packageName !== modal.app.packageName));
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
    setModal(null);
  };

  const handleInstall = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !serial) return;
    e.target.value = '';

    setInstalling(true);
    setInstallProgress(0);
    try {
      const result = await installApk(serial, file, setInstallProgress);
      showToast(result.message, result.success ? 'success' : 'error');
      if (result.success) {
        setLoading(true);
        getApps(serial)
          .then(setApps)
          .catch((err) => showToast(err.message, 'error'))
          .finally(() => setLoading(false));
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setInstalling(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !serial || !restoreTarget) return;
    e.target.value = '';

    try {
      showToast(t('apps.restoreStarted'), 'success');
      const result = await restoreApp(serial, restoreTarget.packageName, file);
      showToast(result.message, result.success ? 'success' : 'error');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setRestoreTarget(null);
    }
  };

  const openPermissions = async (app: AppInfo) => {
    if (!serial) return;
    setPermissionsModal({ app, permissions: [], loading: true });
    try {
      const perms = await getPermissions(serial, app.packageName);
      setPermissionsModal({ app, permissions: perms, loading: false });
    } catch (err: any) {
      showToast(err.message, 'error');
      setPermissionsModal(null);
    }
  };

  const togglePermission = async (perm: AppPermission) => {
    if (!serial || !permissionsModal) return;
    try {
      const result = perm.granted
        ? await revokePermission(serial, permissionsModal.app.packageName, perm.permission)
        : await grantPermission(serial, permissionsModal.app.packageName, perm.permission);
      showToast(result.message, result.success ? 'success' : 'error');
      if (result.success) {
        setPermissionsModal((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            permissions: prev.permissions.map((p) =>
              p.permission === perm.permission ? { ...p, granted: !p.granted } : p
            ),
          };
        });
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="page loading-page">
        <Spinner size={32} />
        <p>{t('apps.loading')}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h2 className="page-title">{t('apps.title')}</h2>

      <div className="apps-toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder={t('apps.search')} />
        <div className="filter-tabs">
          {(['all', 'user', 'system', 'preinstalled'] as const).map((f) => (
            <button
              key={f}
              className={`filter-tab ${typeFilter === f ? 'active' : ''}`}
              onClick={() => setTypeFilter(f)}
            >
              {t(`apps.filter.${f}`)}
            </button>
          ))}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".apk"
          style={{ display: 'none' }}
          onChange={handleInstall}
        />
        <input
          ref={restoreInputRef}
          type="file"
          accept=".ab"
          style={{ display: 'none' }}
          onChange={handleRestore}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={installing}
        >
          {installing ? `${t('apps.installing')} ${installProgress}%` : t('apps.install')}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">{t('apps.empty')}</div>
      ) : (
        <div className="apps-list">
          {filtered.map((app) => (
            <div key={app.packageName} className="app-row">
              <div className="app-info">
                <div className="app-name">{app.appName}</div>
                <div className="app-package mono">{app.packageName}</div>
                {app.versionName && (
                  <span className="app-version">{t('apps.version')}: {app.versionName}</span>
                )}
              </div>

              <div className="app-meta">
                <Badge variant={typeVariant[app.type]}>{t(`apps.labels.${app.type}`)}</Badge>
                {!app.enabled && <Badge variant="danger">{t('apps.disabled')}</Badge>}
                <span className="app-size mono">{formatBytes(app.sizeBytes)}</span>
                {app.dataSizeBytes > 0 && (
                  <span className="app-data-size mono">
                    {t('apps.dataSize')}: {formatBytes(app.dataSizeBytes)}
                  </span>
                )}
                {app.cacheSizeBytes > 0 && (
                  <span className="app-cache-size mono">
                    {t('apps.cacheSize')}: {formatBytes(app.cacheSizeBytes)}
                  </span>
                )}
              </div>

              <div className="app-actions">
                <Button size="sm" variant="ghost" onClick={() => openPermissions(app)}>
                  {t('apps.actions.permissions')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleAction('launch', app)}>
                  {t('apps.actions.launch')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleAction('stop', app)}>
                  {t('apps.actions.stop')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleAction('clearCache', app)}>
                  {t('apps.actions.clearCache')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleAction('clear', app)}>
                  {t('apps.actions.clear')}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => handleAction('disable', app)}>
                  {t('apps.actions.disable')}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => handleAction('extractApk', app)}>
                  {t('apps.actions.extractApk')}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => handleAction('backup', app)}>
                  {t('apps.actions.backup')}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => handleAction('restore', app)}>
                  {t('apps.actions.restore')}
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleAction('remove', app)}>
                  {t('apps.actions.remove')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!modal}
        title={modal?.type === 'remove' ? t('apps.actions.remove') : t('apps.actions.disable')}
        onCancel={() => setModal(null)}
        onConfirm={confirmAction}
        confirmVariant="danger"
        confirmLabel={modal?.type === 'remove' ? t('apps.actions.remove') : t('apps.actions.disable')}
      >
        <p>
          {modal?.type === 'remove'
            ? t('apps.confirmRemove', { appName: modal?.app.appName })
            : t('apps.confirmDisable', { appName: modal?.app.appName })}
        </p>
      </Modal>

      <Modal
        open={!!permissionsModal}
        title={t('apps.permissionsTitle', { appName: permissionsModal?.app.appName })}
        onCancel={() => setPermissionsModal(null)}
      >
        {permissionsModal?.loading ? (
          <div className="permissions-loading">
            <Spinner size={24} />
          </div>
        ) : permissionsModal?.permissions.length === 0 ? (
          <div className="permissions-empty">{t('apps.noPermissions')}</div>
        ) : (
          <div className="permissions-list">
            {permissionsModal?.permissions.map((perm) => {
              const shortName = perm.permission.replace(/^android\.permission\./, '');
              return (
                <div key={perm.permission} className="permission-row">
                  <div className="permission-info">
                    <span className="permission-short">{shortName}</span>
                    {shortName !== perm.permission && (
                      <span className="permission-full mono">{perm.permission}</span>
                    )}
                  </div>
                  <button
                    className={`permission-toggle ${perm.granted ? 'granted' : 'denied'}`}
                    onClick={() => togglePermission(perm)}
                  >
                    {perm.granted ? t('apps.granted') : t('apps.denied')}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
};
