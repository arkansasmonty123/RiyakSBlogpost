import { useEffect, useId, useRef } from 'react';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger';
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Shared confirmation dialog (Scope D). role=dialog, aria-modal, labelled and
 * described, Escape + backdrop cancel, autoFocus, body scroll lock.
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  confirmVariant = 'primary',
  isBusy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const id = useId();
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal-panel panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={`${id}-title`} className="page-title-sm">{title}</h2>
        <p id={`${id}-desc`} className="muted">{message}</p>
        <div className="confirm-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isBusy}>Cancel</button>
          <button type="button" ref={confirmRef} className={confirmVariant === 'danger' ? 'btn btn-danger' : 'btn btn-primary'} onClick={onConfirm} disabled={isBusy}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
