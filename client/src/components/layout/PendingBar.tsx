/**
 * PendingBar — floating HUD showing queued admin batch operations.
 * Mounted at App level so it persists across navigation (not inside AdminPage).
 */
import { Clock, Undo2, Upload, XCircle } from 'lucide-react';
import { useBatchStore } from '../../stores/batchStore';

export default function PendingBar() {
  const { ops, secondsLeft, flushing, dequeue, flush, cancel } = useBatchStore();

  if (ops.length === 0 && !flushing) return null;

  return (
    <div className="pending-bar">
      {flushing ? (
        <>
          <span className="spinner pending-bar__spinner" />
          <span className="pending-bar__text">Đang ghi…</span>
        </>
      ) : (
        <>
          <Clock size={16} className="pending-bar__icon" />

          <span className="pending-bar__text">
            <strong>{ops.length}</strong> thay đổi chờ ghi
            &nbsp;·&nbsp;
            <span className="pending-bar__countdown">tự động sau {secondsLeft}s</span>
          </span>

          {ops.length > 0 && (
            <button
              className="pending-bar__btn pending-bar__btn--ghost"
              title={`Hoàn tác: ${ops[ops.length - 1].rollbackLabel}`}
              onClick={() => dequeue(ops[ops.length - 1].id)}
            >
              <Undo2 size={13} />
              Hoàn tác
            </button>
          )}

          <button
            className="pending-bar__btn pending-bar__btn--primary"
            onClick={() => flush()}
          >
            <Upload size={13} />
            Ghi ngay
          </button>

          <button
            className="pending-bar__btn pending-bar__btn--ghost pending-bar__btn--icon"
            title="Hủy tất cả thay đổi chưa ghi"
            onClick={() => cancel()}
          >
            <XCircle size={14} />
          </button>
        </>
      )}
    </div>
  );
}
