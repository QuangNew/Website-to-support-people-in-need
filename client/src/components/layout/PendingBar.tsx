/**
 * PendingBar — floating HUD showing queued admin batch operations.
 * Mounted at App level so it persists across navigation (not inside AdminPage).
 */
import { Clock, Undo2, Upload, XCircle } from 'lucide-react';
import { useBatchStore } from '../../stores/batchStore';
import { useLanguage } from '../../contexts/LanguageContext';

export default function PendingBar() {
  const { ops, secondsLeft, flushing, dequeue, flush, cancel } = useBatchStore();
  const { t } = useLanguage();

  if (ops.length === 0 && !flushing) return null;

  return (
    <div className="pending-bar">
      {flushing ? (
        <>
          <span className="spinner pending-bar__spinner" />
          <span className="pending-bar__text">{t('pendingBar.writing')}</span>
        </>
      ) : (
        <>
          <Clock size={16} className="pending-bar__icon" />

          <span className="pending-bar__text">
            <strong>{ops.length}</strong> {t('pendingBar.pendingChanges')}
            &nbsp;·&nbsp;
            <span className="pending-bar__countdown">{t('pendingBar.autoAfter', { s: secondsLeft })}</span>
          </span>

          {ops.length > 0 && (
            <button
              className="pending-bar__btn pending-bar__btn--ghost"
              title={`${t('pendingBar.undo')}: ${ops[ops.length - 1].rollbackLabel}`}
              onClick={() => dequeue(ops[ops.length - 1].id)}
            >
              <Undo2 size={13} />
              {t('pendingBar.undo')}
            </button>
          )}

          <button
            className="pending-bar__btn pending-bar__btn--primary"
            onClick={() => flush()}
          >
            <Upload size={13} />
            {t('pendingBar.writeNow')}
          </button>

          <button
            className="pending-bar__btn pending-bar__btn--ghost pending-bar__btn--icon"
            title={t('pendingBar.cancelAll')}
            onClick={() => cancel()}
          >
            <XCircle size={14} />
          </button>
        </>
      )}
    </div>
  );
}
