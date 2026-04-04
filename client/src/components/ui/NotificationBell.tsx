import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import { notificationApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Notification {
  id: number;
  messageText: string;
  isRead: boolean;
  createdAt: string;
}

interface UnreadCountResponse {
  count: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Vừa xong';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NotificationBell() {
  const { isAuthenticated } = useAuthStore();

  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch unread count ──────────────────────────────────────────────────────
  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await notificationApi.getUnreadCount();
      const data = res.data as UnreadCountResponse;
      setUnreadCount(data.count ?? 0);
    } catch {
      // silently ignore polling errors
    }
  }, [isAuthenticated]);

  // ── Fetch notification list (when dropdown opens) ──────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await notificationApi.getNotifications({ page: 1, pageSize: 20 });
      const items = (res.data as any).items as Notification[];
      setNotifications(Array.isArray(items) ? items : []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // ── Poll every 30 s when authenticated ─────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    fetchUnreadCount();
    pollRef.current = setInterval(fetchUnreadCount, 30_000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isAuthenticated, fetchUnreadCount]);

  // ── Load notifications when dropdown opens ─────────────────────────────────
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // ── Close on outside click ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // ── Mark single read ────────────────────────────────────────────────────────
  const handleMarkRead = async (id: number) => {
    try {
      await notificationApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  // ── Mark all read ───────────────────────────────────────────────────────────
  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  // ── Delete notification ─────────────────────────────────────────────────────
  const handleDelete = async (e: React.MouseEvent, id: number, wasUnread: boolean) => {
    e.stopPropagation();
    try {
      await notificationApi.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  if (!isAuthenticated) return null;

  // ─── Styles ──────────────────────────────────────────────────────────────

  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
  };

  const bellButtonStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  };

  const badgeStyle: React.CSSProperties = {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 9999,
    background: 'var(--danger-500)',
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    lineHeight: '16px',
    textAlign: 'center',
    padding: '0 3px',
    pointerEvents: 'none',
  };

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 320,
    maxHeight: 440,
    overflowY: 'auto',
    zIndex: 1000,
    borderRadius: 'var(--radius-lg)',
    border: '1px solid color-mix(in srgb, var(--text-muted) 20%, transparent)',
    background: 'var(--bg-primary)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    animation: 'notif-fade-in 0.15s ease',
  };

  const dropdownHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--sp-3) var(--sp-4)',
    borderBottom: '1px solid color-mix(in srgb, var(--text-muted) 15%, transparent)',
    position: 'sticky',
    top: 0,
    background: 'var(--bg-primary)',
    zIndex: 1,
  };

  const headerTitleStyle: React.CSSProperties = {
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-2)',
  };

  const markAllBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-1)',
    fontSize: 'var(--text-xs)',
    color: 'var(--primary-500)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm)',
  };

  const emptyStyle: React.CSSProperties = {
    padding: 'var(--sp-8) var(--sp-4)',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: 'var(--text-sm)',
  };

  const spinnerStyle: React.CSSProperties = {
    padding: 'var(--sp-6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  };

  return (
    <>
      {/* Keyframe injection — injected once into the document */}
      <style>{`
        @keyframes notif-fade-in {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .notif-item:hover { background: var(--bg-secondary) !important; }
        .notif-item:hover .notif-delete { opacity: 1 !important; }
        .notif-bell-btn:hover { background: var(--bg-secondary) !important; color: var(--text-primary) !important; }
        .mark-all-btn:hover { background: color-mix(in srgb, var(--primary-500) 12%, transparent) !important; }
      `}</style>

      <div ref={wrapperRef} style={wrapperStyle}>
        {/* ── Bell button ── */}
        <button
          className="notif-bell-btn"
          style={bellButtonStyle}
          onClick={() => setOpen((v) => !v)}
          title="Thông báo"
          aria-label="Thông báo"
        >
          <Bell size={20} strokeWidth={2} />
          {unreadCount > 0 && (
            <span style={badgeStyle}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* ── Dropdown ── */}
        {open && (
          <div style={dropdownStyle} role="menu" aria-label="Danh sách thông báo">
            {/* Header */}
            <div style={dropdownHeaderStyle}>
              <span style={headerTitleStyle}>
                <Bell size={14} />
                Thông báo
                {unreadCount > 0 && (
                  <span style={{
                    background: 'var(--danger-500)',
                    color: '#fff',
                    borderRadius: 9999,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 6px',
                  }}>
                    {unreadCount}
                  </span>
                )}
              </span>

              {notifications.some((n) => !n.isRead) && (
                <button
                  className="mark-all-btn"
                  style={markAllBtnStyle}
                  onClick={handleMarkAllRead}
                  title="Đánh dấu tất cả đã đọc"
                >
                  <CheckCheck size={13} />
                  Đọc tất cả
                </button>
              )}
            </div>

            {/* Body */}
            {loading ? (
              <div style={spinnerStyle}>
                <span style={{
                  width: 20,
                  height: 20,
                  border: '2px solid var(--text-muted)',
                  borderTopColor: 'var(--primary-500)',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.7s linear infinite',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : notifications.length === 0 ? (
              <div style={emptyStyle}>
                <Bell size={28} style={{ opacity: 0.25, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                Không có thông báo nào
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {notifications.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onMarkRead={handleMarkRead}
                    onDelete={handleDelete}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Notification Item sub-component ─────────────────────────────────────────

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: number) => void;
  onDelete: (e: React.MouseEvent, id: number, wasUnread: boolean) => void;
}

function NotificationItem({ notification, onMarkRead, onDelete }: NotificationItemProps) {
  const { id, messageText, isRead, createdAt } = notification;

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--sp-3)',
    padding: 'var(--sp-3) var(--sp-4)',
    cursor: isRead ? 'default' : 'pointer',
    background: isRead
      ? 'transparent'
      : 'color-mix(in srgb, var(--primary-500) 6%, transparent)',
    borderBottom: '1px solid color-mix(in srgb, var(--text-muted) 10%, transparent)',
    transition: 'background 0.12s',
    position: 'relative',
  };

  const dotStyle: React.CSSProperties = {
    flexShrink: 0,
    marginTop: 5,
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: isRead ? 'transparent' : 'var(--primary-500)',
    border: isRead ? '1.5px solid var(--text-muted)' : 'none',
    transition: 'background 0.15s',
  };

  const textStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const messageStyle: React.CSSProperties = {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-primary)',
    lineHeight: 1.45,
    marginBottom: 2,
    fontWeight: isRead ? 400 : 500,
    wordBreak: 'break-word',
  };

  const timeStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flexShrink: 0,
  };

  const iconBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    transition: 'background 0.12s, color 0.12s',
  };

  return (
    <li
      className="notif-item"
      style={itemStyle}
      onClick={() => !isRead && onMarkRead(id)}
      role="menuitem"
    >
      {/* Unread dot */}
      <span style={dotStyle} aria-hidden="true" />

      {/* Message + time */}
      <div style={textStyle}>
        <p style={messageStyle}>{messageText}</p>
        <span style={timeStyle}>{timeAgo(createdAt)}</span>
      </div>

      {/* Action buttons */}
      <div style={actionsStyle}>
        {!isRead && (
          <button
            style={iconBtnStyle}
            onClick={(e) => { e.stopPropagation(); onMarkRead(id); }}
            title="Đánh dấu đã đọc"
            aria-label="Đánh dấu đã đọc"
          >
            <Check size={13} />
          </button>
        )}
        <button
          className="notif-delete"
          style={{ ...iconBtnStyle, opacity: 0, transition: 'opacity 0.15s, background 0.12s' }}
          onClick={(e) => onDelete(e, id, !isRead)}
          title="Xoá thông báo"
          aria-label="Xoá thông báo"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </li>
  );
}
