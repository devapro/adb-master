import React from 'react';
import { Button } from './Button';
import { useTranslation } from 'react-i18next';
import './Modal.css';

interface ModalProps {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onConfirm?: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'danger';
}

export const Modal: React.FC<ModalProps> = ({
  open,
  title,
  children,
  onConfirm,
  onCancel,
  confirmLabel,
  confirmVariant = 'primary',
}) => {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          {onConfirm && (
            <Button variant={confirmVariant} onClick={onConfirm}>
              {confirmLabel || t('common.confirm')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
