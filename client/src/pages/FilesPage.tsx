import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileEntry, StorageSummary } from '../types';
import { getFiles, getLargeFiles, getStorage, deleteFile, uploadFile, downloadFile } from '../api/files.api';
import { Button } from '../components/common/Button';
import { Spinner } from '../components/common/Spinner';
import { Modal } from '../components/common/Modal';
import { showToast } from '../components/common/Toast';
import './FilesPage.css';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export const FilesPage: React.FC = () => {
  const { t } = useTranslation();
  const { serial } = useParams<{ serial: string }>();
  const [storage, setStorage] = useState<StorageSummary | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [largeFiles, setLargeFiles] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('/sdcard');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'browse' | 'large'>('large');
  const [deleteModal, setDeleteModal] = useState<FileEntry | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [downloading, setDownloading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!serial) return;
    setLoading(true);
    Promise.all([
      getStorage(serial).then(setStorage),
      getLargeFiles(serial).then(setLargeFiles),
    ])
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [serial]);

  useEffect(() => {
    if (!serial || tab !== 'browse') return;
    setLoading(true);
    getFiles(serial, currentPath)
      .then(setFiles)
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [serial, currentPath, tab]);

  const handleNavigate = (entry: FileEntry) => {
    if (entry.isDirectory) {
      setCurrentPath(entry.path);
    }
  };

  const handleDelete = async () => {
    if (!serial || !deleteModal) return;
    try {
      const result = await deleteFile(serial, deleteModal.path, deleteModal.isDirectory);
      if (result.success) {
        showToast(t('common.success'), 'success');
        if (tab === 'large') {
          setLargeFiles((prev) => prev.filter((f) => f.path !== deleteModal.path));
        } else {
          setFiles((prev) => prev.filter((f) => f.path !== deleteModal.path));
        }
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
    setDeleteModal(null);
  };

  const goUp = () => {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    setCurrentPath(parent);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !serial) return;
    e.target.value = '';

    const devicePath = `${currentPath}/${file.name}`.replace(/\/+/g, '/');
    setUploading(true);
    setUploadProgress(0);
    try {
      const result = await uploadFile(serial, file, devicePath, setUploadProgress);
      if (result.success) {
        showToast(t('common.success'), 'success');
        getFiles(serial, currentPath).then(setFiles);
      } else {
        showToast(t('files.uploadFailed'), 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (file: FileEntry) => {
    if (!serial) return;
    setDownloading(file.path);
    try {
      await downloadFile(serial, file.path);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setDownloading(null);
    }
  };

  const usedPercent = storage ? Math.round((storage.usedBytes / storage.totalBytes) * 100) : 0;

  if (loading && !storage) {
    return (
      <div className="page loading-page">
        <Spinner size={32} />
        <p>{t('files.loading')}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h2 className="page-title">{t('files.title')}</h2>

      {storage && (
        <div className="storage-card">
          <h3>{t('files.storage')}</h3>
          <div className="storage-bar-container">
            <div className="storage-bar">
              <div className="storage-bar-fill" style={{ width: `${usedPercent}%` }} />
            </div>
            <span className="storage-percent mono">{usedPercent}%</span>
          </div>
          <div className="storage-stats">
            <span>{t('files.used')}: <strong className="mono">{formatBytes(storage.usedBytes)}</strong></span>
            <span>{t('files.free')}: <strong className="mono">{formatBytes(storage.freeBytes)}</strong></span>
            <span>{t('files.total')}: <strong className="mono">{formatBytes(storage.totalBytes)}</strong></span>
          </div>
        </div>
      )}

      <div className="files-tabs">
        <button className={`filter-tab ${tab === 'large' ? 'active' : ''}`} onClick={() => setTab('large')}>
          {t('files.largeFiles')}
        </button>
        <button className={`filter-tab ${tab === 'browse' ? 'active' : ''}`} onClick={() => setTab('browse')}>
          {t('files.browse')}
        </button>
      </div>

      {tab === 'browse' && (
        <div className="files-path">
          <Button size="sm" variant="ghost" onClick={goUp} disabled={currentPath === '/'}>
            ..
          </Button>
          <span className="mono">{currentPath}</span>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleUpload}
          />
          <Button
            size="sm"
            variant="primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? `${t('files.uploading')} ${uploadProgress}%` : t('files.upload')}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="loading-page"><Spinner /></div>
      ) : (
        <div className="files-table">
          <div className="files-header">
            <span className="file-col-name">{t('files.name')}</span>
            <span className="file-col-size">{t('files.size')}</span>
            <span className="file-col-date">{t('files.modified')}</span>
            <span className="file-col-actions" />
          </div>
          {(tab === 'large' ? largeFiles : files).map((file) => (
            <div
              key={file.path}
              className={`file-row ${file.isDirectory ? 'is-dir' : ''}`}
              onClick={() => handleNavigate(file)}
            >
              <span className="file-col-name">
                {file.isDirectory ? '📁 ' : '📄 '}
                {file.name}
              </span>
              <span className="file-col-size mono">{formatBytes(file.sizeBytes)}</span>
              <span className="file-col-date">{file.modifiedAt}</span>
              <span className="file-col-actions">
                {!file.isDirectory && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={downloading === file.path}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(file);
                    }}
                  >
                    {downloading === file.path ? '...' : t('files.download')}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteModal(file);
                  }}
                >
                  {t('files.delete')}
                </Button>
              </span>
            </div>
          ))}
          {(tab === 'large' ? largeFiles : files).length === 0 && (
            <div className="empty-state">{t('files.noFiles')}</div>
          )}
        </div>
      )}

      <Modal
        open={!!deleteModal}
        title={t('files.delete')}
        onCancel={() => setDeleteModal(null)}
        onConfirm={handleDelete}
        confirmVariant="danger"
        confirmLabel={t('files.delete')}
      >
        <p>{t('files.confirmDelete', { name: deleteModal?.name })}</p>
        <p className="mono" style={{ fontSize: 12, marginTop: 8 }}>{deleteModal?.path}</p>
      </Modal>
    </div>
  );
};
