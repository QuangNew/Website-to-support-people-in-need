/**
 * batchStore — global Zustand store for the admin batch-write queue.
 *
 * Lives OUTSIDE React component tree so the countdown continues even when
 * the user navigates away from /admin. The PendingBar reads from this store
 * and is mounted at the App level (App.tsx), not inside AdminPage.
 */
import { create } from 'zustand';
import { adminApi } from '../services/api';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────
export type BatchOpType = 'approveRole' | 'rejectVerification' | 'deletePost';

export interface BatchOp {
  id: string;
  type: BatchOpType;
  userId?: string;
  role?: string;
  postId?: number;
  rollbackLabel: string;
}

interface BatchState {
  ops: BatchOp[];
  secondsLeft: number;
  flushing: boolean;

  // Actions
  enqueue: (op: Omit<BatchOp, 'id'>) => string;
  dequeue: (id: string) => void;
  flush: () => Promise<void>;
  cancel: () => void;
}

// ─── Constants ────────────────────────────────────────────
const FLUSH_AFTER_S = 60;

// ─── Timer handles (module-level, survives re-renders) ────
let _countdownInterval: ReturnType<typeof setInterval> | null = null;
let _autoFlushTimeout: ReturnType<typeof setTimeout> | null = null;

function clearTimers() {
  if (_countdownInterval) { clearInterval(_countdownInterval); _countdownInterval = null; }
  if (_autoFlushTimeout) { clearTimeout(_autoFlushTimeout); _autoFlushTimeout = null; }
}

function startTimers() {
  if (_countdownInterval) return; // already running

  _countdownInterval = setInterval(() => {
    useBatchStore.setState((s) => ({ secondsLeft: s.secondsLeft <= 1 ? 0 : s.secondsLeft - 1 }));
  }, 1000);

  _autoFlushTimeout = setTimeout(() => {
    useBatchStore.getState().flush();
  }, FLUSH_AFTER_S * 1000);
}

// ─── Store ────────────────────────────────────────────────
export const useBatchStore = create<BatchState>((set, get) => ({
  ops: [],
  secondsLeft: FLUSH_AFTER_S,
  flushing: false,

  enqueue(op) {
    const id = `${op.type}-${op.userId ?? op.postId}-${Date.now()}`;
    set((s) => {
      const key = op.userId ?? String(op.postId);
      // dedup: replace same type+key
      const filtered = s.ops.filter(
        (o) => !(o.type === op.type && (o.userId === key || String(o.postId) === key))
      );
      return { ops: [...filtered, { ...op, id }] };
    });
    startTimers();
    return id;
  },

  dequeue(id) {
    set((s) => {
      const next = s.ops.filter((o) => o.id !== id);
      if (next.length === 0) {
        clearTimers();
        return { ops: [], secondsLeft: FLUSH_AFTER_S };
      }
      return { ops: next };
    });
  },

  async flush() {
    const { ops } = get();
    if (ops.length === 0) return;

    clearTimers();
    set({ flushing: true });

    const roleApprovals = ops
      .filter((o) => o.type === 'approveRole')
      .map((o) => ({ userId: o.userId!, role: o.role! }));
    const roleRejections = ops
      .filter((o) => o.type === 'rejectVerification')
      .map((o) => o.userId!);
    const postDeletions = ops
      .filter((o) => o.type === 'deletePost')
      .map((o) => o.postId!);

    // Clear queue immediately (optimistic)
    set({ ops: [], secondsLeft: FLUSH_AFTER_S });

    try {
      const res = await adminApi.batchActions({ roleApprovals, roleRejections, postDeletions });
      const { applied, failed } = res.data as { applied: number; failed: number };
      if (failed === 0) {
        toast.success(`✅ Đã ghi ${applied} thay đổi`);
      } else {
        toast.error(`⚠️ ${applied} thành công, ${failed} thất bại`);
      }
      // Trigger a custom event so AdminPage panels can refresh
      window.dispatchEvent(new CustomEvent('batch-flush-done'));
    } catch {
      toast.error('Ghi batch thất bại — vui lòng thử lại');
    } finally {
      set({ flushing: false });
    }
  },

  cancel() {
    clearTimers();
    set({ ops: [], secondsLeft: FLUSH_AFTER_S });
  },
}));
