import { useEffect, useState } from 'react';
import { BellRing, EyeOff, Loader2 } from 'lucide-react';
import Modal from './Modal';
import { useLanguage } from '../../contexts/LanguageContext';
import type { HideCommentRequest } from '../../services/api';

interface HideCommentModalProps {
  isOpen: boolean;
  commentPreview?: string;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (payload: HideCommentRequest) => Promise<void> | void;
}

const DURATION_OPTIONS: Array<{ value: string; labelKey: string }> = [
  { value: '1', labelKey: 'social.hideDuration1Day' },
  { value: '3', labelKey: 'social.hideDuration3Days' },
  { value: '7', labelKey: 'social.hideDuration7Days' },
  { value: '14', labelKey: 'social.hideDuration14Days' },
  { value: '30', labelKey: 'social.hideDuration30Days' },
  { value: '90', labelKey: 'social.hideDuration90Days' },
  { value: 'indefinite', labelKey: 'social.hideDurationIndefinite' },
];

export default function HideCommentModal({
  isOpen,
  commentPreview,
  submitting = false,
  onClose,
  onConfirm,
}: HideCommentModalProps) {
  const { t } = useLanguage();
  const [durationValue, setDurationValue] = useState('30');
  const [reason, setReason] = useState('');
  const [notifyUser, setNotifyUser] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setDurationValue('30');
    setReason('');
    setNotifyUser(true);
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedReason = reason.trim();
    if (!trimmedReason || submitting) return;

    await onConfirm({
      durationDays: durationValue === 'indefinite' ? null : Number(durationValue),
      reason: trimmedReason,
      notifyUser,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-2)' }}>
            <div className="auth-logo" style={{ width: 42, height: 42, margin: 0 }}>
              <EyeOff size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 'var(--text-xl)' }}>{t('social.hideCommentTitle')}</h2>
              <p className="auth-subtitle" style={{ margin: '4px 0 0' }}>{t('social.hideCommentSubtitle')}</p>
            </div>
          </div>

          {commentPreview && (
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
              “{commentPreview.length > 180 ? `${commentPreview.slice(0, 180)}...` : commentPreview}”
            </div>
          )}
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <span style={{ fontWeight: 600 }}>{t('social.hideDurationLabel')}</span>
          <select
            value={durationValue}
            onChange={(event) => setDurationValue(event.target.value)}
            disabled={submitting}
            className="btn-ghost"
            style={{
              width: '100%',
              textAlign: 'left',
              border: '1px solid var(--glass-border)',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {DURATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <span style={{ fontWeight: 600 }}>{t('social.hideReasonLabel')}</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t('social.hideReasonPlaceholder')}
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

        <label style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--sp-3)',
          padding: 'var(--sp-3)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--glass-border)',
          background: 'var(--bg-secondary)',
        }}>
          <input
            type="checkbox"
            checked={notifyUser}
            onChange={(event) => setNotifyUser(event.target.checked)}
            disabled={submitting}
            style={{ marginTop: 3 }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontWeight: 600 }}>
              <BellRing size={16} />
              {t('social.hideNotifyUser')}
            </div>
            <p className="auth-subtitle" style={{ margin: '4px 0 0' }}>{t('social.hideNotifyHelp')}</p>
          </div>
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-2)' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-danger" disabled={submitting || !reason.trim()}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <EyeOff size={14} />}
            {t('social.hideCommentSubmit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}