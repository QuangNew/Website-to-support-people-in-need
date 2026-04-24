import { useEffect, useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import Modal from './Modal';
import { useLanguage } from '../../contexts/LanguageContext';

interface ReportPostModalProps {
  isOpen: boolean;
  postPreview?: string;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

export default function ReportPostModal({
  isOpen,
  postPreview,
  submitting = false,
  onClose,
  onConfirm,
}: ReportPostModalProps) {
  const { t } = useLanguage();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
    }
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedReason = reason.trim();
    if (!trimmedReason || submitting) {
      return;
    }

    await onConfirm(trimmedReason);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-2)' }}>
            <div className="auth-logo" style={{ width: 42, height: 42, margin: 0 }}>
              <Flag size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 'var(--text-xl)' }}>{t('social.reportPostTitle')}</h2>
              <p className="auth-subtitle" style={{ margin: '4px 0 0' }}>{t('social.reportPostSubtitle')}</p>
            </div>
          </div>

          {postPreview && (
            <div style={{
              marginTop: 'var(--sp-3)',
              padding: 'var(--sp-3)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--glass-border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-sm)',
              lineHeight: 1.6,
            }}>
              “{postPreview.length > 180 ? `${postPreview.slice(0, 180)}...` : postPreview}”
            </div>
          )}
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <span style={{ fontWeight: 600 }}>{t('social.reportReasonLabel')}</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t('social.reportReasonPlaceholder')}
            disabled={submitting}
            rows={4}
            style={{
              width: '100%',
              resize: 'vertical',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
              color: 'inherit',
              padding: '12px',
              font: 'inherit',
              lineHeight: 1.6,
            }}
          />
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-2)' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-secondary" disabled={submitting || !reason.trim()}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />}
            {t('social.reportPostSubmit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}