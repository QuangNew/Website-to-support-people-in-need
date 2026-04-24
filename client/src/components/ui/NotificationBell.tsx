import { useState, useEffect, useRef, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import { Bell, Check, CheckCheck, Trash2, Megaphone } from 'lucide-react';
import { notificationApi, announcementApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useLanguage } from '../../contexts/LanguageContext';

const NOTIFICATION_POLL_MS = 10_000;
const NOTIFICATION_HUB_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/api\/?$/, '') + '/hubs/notifications';
const ANNOUNCEMENT_CURSOR_PREFIX = 'notification:last-seen-announcement:';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Notification {
  id: number;
  messageText: string;
  isRead: boolean;
  createdAt: string;
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  adminName: string;
  createdAt: string;
  expiresAt: string | null;
}

interface UnifiedItem {
  kind: 'notification' | 'announcement';
  id: string;            // prefixed to avoid collision: "n-1", "a-1"
  text: string;
  subtext?: string;
  isRead: boolean;
  createdAt: string;
  rawId: number;
}

interface UnreadCountResponse {
  count: number;
}

function getAnnouncementCursorKey(userId: string): string {
  return `${ANNOUNCEMENT_CURSOR_PREFIX}${userId}`;
}

function readAnnouncementCursor(userId: string): number | null {
  try {
    const value = localStorage.getItem(getAnnouncementCursorKey(userId));
    if (value == null) return null;

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeAnnouncementCursor(userId: string, timestamp: number | null): void {
  try {
    localStorage.setItem(getAnnouncementCursorKey(userId), String(timestamp ?? 0));
  } catch {
    // Ignore storage failures and keep the in-memory state only.
  }
}

function getAnnouncementTimestamp(createdAt: string): number {
  const timestamp = new Date(createdAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string, t: (key: string) => string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return t('ping.time.justNow');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${t('ping.time.minutesAgo')}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${t('ping.time.hoursAgo')}`;
  const days = Math.floor(hours / 24);
  return `${days} ${t('ping.time.daysAgo')}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NotificationBell() {
  const { isAuthenticated, user } = useAuthStore();
  const { t } = useLanguage();

  const [open, setOpen] = useState(false);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [announcementUnreadCount, setAnnouncementUnreadCount] = useState(0);
  const [hasFreshActivity, setHasFreshActivity] = useState(false);
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const openRef = useRef(open);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const announcementInitRef = useRef(false);
  const previousUnreadCountRef = useRef<number | null>(null);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    announcementInitRef.current = false;
    setAnnouncementUnreadCount(0);
    setHasFreshActivity(false);
    previousUnreadCountRef.current = null;
  }, [user?.id]);

  useEffect(() => {
    if (isAuthenticated) return;

    setOpen(false);
    setItems([]);
    setNotificationUnreadCount(0);
    setAnnouncementUnreadCount(0);
    setHasFreshActivity(false);
    previousUnreadCountRef.current = null;
  }, [isAuthenticated]);

  useEffect(() => {
    const totalUnread = notificationUnreadCount + announcementUnreadCount;
    const previousUnread = previousUnreadCountRef.current;

    if (previousUnread !== null && totalUnread > previousUnread && !openRef.current) {
      setHasFreshActivity(true);
    }

    if (totalUnread === 0) {
      setHasFreshActivity(false);
    }

    previousUnreadCountRef.current = totalUnread;
  }, [announcementUnreadCount, notificationUnreadCount]);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await notificationApi.getUnreadCount();
      const data = res.data as UnreadCountResponse;
      setNotificationUnreadCount(data.count ?? 0);
    } catch { /* silently ignore */ }
  }, [isAuthenticated]);

  const syncAnnouncementUnread = useCallback((announcements: Announcement[], markSeen: boolean) => {
    if (!user?.id) {
      setAnnouncementUnreadCount(0);
      return;
    }

    const latestTimestamp = announcements.length > 0
      ? getAnnouncementTimestamp(announcements[0].createdAt)
      : null;

    if (markSeen) {
      writeAnnouncementCursor(user.id, latestTimestamp);
      announcementInitRef.current = true;
      setAnnouncementUnreadCount(0);
      return;
    }

    const storedCursor = readAnnouncementCursor(user.id);
    if (storedCursor === null && !announcementInitRef.current) {
      writeAnnouncementCursor(user.id, latestTimestamp);
      announcementInitRef.current = true;
      setAnnouncementUnreadCount(0);
      return;
    }

    announcementInitRef.current = true;
    const lastSeenAt = storedCursor ?? 0;
    setAnnouncementUnreadCount(
      announcements.filter((announcement) => getAnnouncementTimestamp(announcement.createdAt) > lastSeenAt).length,
    );
  }, [user?.id]);

  const refreshAnnouncementUnread = useCallback(async (markSeen = false) => {
    if (!isAuthenticated) return;

    try {
      const res = await announcementApi.getActive(20);
      const announcements: Announcement[] = (res.data as Announcement[]) ?? [];
      syncAnnouncementUnread(announcements, markSeen);
    } catch {
      if (markSeen) {
        setAnnouncementUnreadCount(0);
      }
    }
  }, [isAuthenticated, syncAnnouncementUnread]);

  const fetchAll = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const [notiRes, annRes] = await Promise.all([
        notificationApi.getNotifications({ page: 1, pageSize: 30 }),
        announcementApi.getActive(20),
      ]);

      const notis: Notification[] = ((notiRes.data as any).items as Notification[]) ?? [];
      const anns: Announcement[] = (annRes.data as Announcement[]) ?? [];
        syncAnnouncementUnread(anns, true);

      const unified: UnifiedItem[] = [
        ...notis.map((n): UnifiedItem => ({
          kind: 'notification',
          id: `n-${n.id}`,
          rawId: n.id,
          text: n.messageText,
          isRead: n.isRead,
          createdAt: n.createdAt,
        })),
        ...anns.map((a): UnifiedItem => ({
          kind: 'announcement',
          id: `a-${a.id}`,
          rawId: a.id,
          text: a.title,
          subtext: a.content.length > 100 ? a.content.slice(0, 100) + '\u2026' : a.content,
          isRead: true,   // announcements have no read state
          createdAt: a.createdAt,
        })),
      ];

      // Sort newest first
      unified.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setItems(unified);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, syncAnnouncementUnread]);

  const refreshBellState = useCallback(() => {
    void fetchUnreadCount();

    if (openRef.current) {
      void fetchAll();
      return;
    }

    void refreshAnnouncementUnread(false);
  }, [fetchAll, fetchUnreadCount, refreshAnnouncementUnread]);

  // Poll every 30s
  useEffect(() => {
    if (!isAuthenticated) return;
    refreshBellState();
    pollRef.current = setInterval(refreshBellState, NOTIFICATION_POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isAuthenticated, refreshBellState]);

  useEffect(() => {
    if (!isAuthenticated) {
      if (connectionRef.current) {
        void connectionRef.current.stop();
        connectionRef.current = null;
      }
      return;
    }

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(NOTIFICATION_HUB_URL, { withCredentials: true })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('UnreadCountChanged', (data: { totalUnread?: number }) => {
      setNotificationUnreadCount(Math.max(0, Number(data?.totalUnread ?? 0)));
      if (openRef.current) {
        void fetchAll();
      }
    });

    connection.on('AnnouncementsChanged', () => {
      if (openRef.current) {
        void fetchAll();
        return;
      }

      void refreshAnnouncementUnread(false);
    });

    connection.onreconnected(async () => {
      refreshBellState();
    });

    connection.start()
      .then(async () => {
        refreshBellState();
      })
      .catch((err) => {
        console.error('Notification SignalR connection error:', err);
      });

    connectionRef.current = connection;

    return () => {
      connection.off('UnreadCountChanged');
      connection.off('AnnouncementsChanged');
      if (connectionRef.current === connection) {
        connectionRef.current = null;
      }
      void connection.stop();
    };
  }, [fetchAll, isAuthenticated, refreshAnnouncementUnread, refreshBellState]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const refresh = () => {
      refreshBellState();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isAuthenticated, refreshBellState]);

  // Load data when dropdown opens
  useEffect(() => {
    if (open) fetchAll();
  }, [open, fetchAll]);

  // Close on outside click
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

  const handleMarkRead = async (id: number) => {
    try {
      await notificationApi.markRead(id);
      setItems(prev => prev.map(it => it.id === `n-${id}` ? { ...it, isRead: true } : it));
      setNotificationUnreadCount(c => Math.max(0, c - 1));
    } catch { /* ignore */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setItems(prev => prev.map(it => it.kind === 'notification' ? { ...it, isRead: true } : it));
      setNotificationUnreadCount(0);
    } catch { /* ignore */ }
  };

  const handleDelete = async (e: React.MouseEvent, item: UnifiedItem) => {
    e.stopPropagation();
    if (item.kind !== 'notification') return;
    try {
      await notificationApi.deleteNotification(item.rawId);
      setItems(prev => prev.filter(it => it.id !== item.id));
      if (!item.isRead) setNotificationUnreadCount(c => Math.max(0, c - 1));
    } catch { /* ignore */ }
  };

  if (!isAuthenticated) return null;

  const unreadCount = notificationUnreadCount + announcementUnreadCount;
  const hasUnread = items.some(it => it.kind === 'notification' && !it.isRead);
  const bellIsHighlighted = unreadCount > 0;

  return (
    <>
      <style>{`
        @keyframes notif-fade-in {
          from { opacity: 0; transform: translateY(6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .notif-item:hover { background: var(--bg-secondary) !important; }
        .notif-item:hover .notif-delete { opacity: 1 !important; }
        .notif-bell-btn:hover { background: var(--bg-secondary) !important; color: var(--text-primary) !important; }
        .notif-bell-btn--highlight,
        .notif-bell-btn--highlight:hover {
          color: var(--warning-500) !important;
        }
        .mark-all-btn:hover { background: color-mix(in srgb, var(--primary-500) 12%, transparent) !important; }
        @keyframes notif-badge-pop {
          0% { transform: scale(0.85); }
          70% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
      `}</style>

      <div ref={wrapperRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <button
          className={`notif-bell-btn ${bellIsHighlighted ? 'notif-bell-btn--highlight' : ''}`}
          style={{
            position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 'var(--radius-md)', border: 'none',
            background: 'transparent', color: bellIsHighlighted ? 'var(--warning-500)' : 'var(--text-secondary)', cursor: 'pointer',
            transition: 'background 0.15s, color 0.15s', flexShrink: 0,
          }}
          onClick={() => {
            setHasFreshActivity(false);
            setOpen(v => !v);
          }}
          title={t('notification.bellTitle')}
          aria-label={t('notification.bellTitle')}
        >
          <Bell size={18} strokeWidth={2} />
          {hasFreshActivity && (
            <span style={{
              position: 'absolute', top: -1, right: -1, width: 10, height: 10,
              borderRadius: 9999, background: 'var(--warning-500)',
              border: '2px solid var(--bg-primary)', boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)',
              pointerEvents: 'none', display: 'block',
              animation: 'notif-badge-pop 0.18s ease-out',
            }} />
          )}
        </button>

        {open && (
          <div style={{
            position: 'absolute', right: 'calc(-1 * var(--sp-2, 8px))', top: '100%', marginTop: 8,
            width: 360, maxHeight: 480, zIndex: 1000,
            borderRadius: 14,
            border: '1px solid color-mix(in srgb, var(--text-muted) 15%, transparent)',
            background: 'var(--bg-primary)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.08)',
            animation: 'notif-fade-in 0.18s cubic-bezier(.2,.6,.35,1)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }} role="menu" aria-label={t('notification.bellTitle')}>

            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderBottom: '1px solid color-mix(in srgb, var(--text-muted) 12%, transparent)',
              position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 1,
            }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                {t('notification.title')}
                {unreadCount > 0 && (
                  <span style={{
                    marginLeft: 6, background: 'var(--danger-500)', color: '#fff', borderRadius: 9999,
                    fontSize: 9, fontWeight: 700, padding: '0 5px', lineHeight: '14px',
                  }}>{unreadCount}</span>
                )}
              </span>
              {hasUnread && (
                <button
                  className="mark-all-btn"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--sp-1)',
                    fontSize: 'var(--text-xs)', color: 'var(--primary-500)', background: 'transparent',
                    border: 'none', cursor: 'pointer', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                  }}
                  onClick={handleMarkAllRead}
                  title={t('notification.markAllReadTitle')}
                >
                  <CheckCheck size={12} /> {t('notification.markAllRead')}
                </button>
              )}
            </div>

            {/* Body */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loading ? (
                <div style={{ padding: 'var(--sp-6)', display: 'flex', justifyContent: 'center' }}>
                  <span style={{
                    width: 20, height: 20, border: '2px solid var(--text-muted)',
                    borderTopColor: 'var(--primary-500)', borderRadius: '50%',
                    display: 'inline-block', animation: 'spin 0.7s linear infinite',
                  }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              ) : items.length === 0 ? (
                <div style={{ padding: 'var(--sp-8) var(--sp-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                  <Bell size={28} style={{ opacity: 0.25, display: 'block', margin: '0 auto 8px' }} />
                  {t('notification.empty')}
                </div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {items.map(item => (
                    <li
                      key={item.id}
                      className="notif-item"
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)',
                        padding: 'var(--sp-3) var(--sp-4)',
                        cursor: item.kind === 'notification' && !item.isRead ? 'pointer' : 'default',
                        background: item.kind === 'notification' && !item.isRead
                          ? 'color-mix(in srgb, var(--primary-500) 6%, transparent)'
                          : 'transparent',
                        borderBottom: '1px solid color-mix(in srgb, var(--text-muted) 10%, transparent)',
                        transition: 'background 0.12s', position: 'relative',
                      }}
                      onClick={() => item.kind === 'notification' && !item.isRead && handleMarkRead(item.rawId)}
                      role="menuitem"
                    >
                      {/* Indicator */}
                      <span style={{
                        flexShrink: 0, marginTop: 5, width: 8, height: 8, borderRadius: '50%',
                        ...(item.kind === 'announcement'
                          ? { background: 'var(--warning-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }
                          : item.isRead
                            ? { border: '1.5px solid var(--text-muted)', background: 'transparent' }
                            : { background: 'var(--primary-500)' }
                        ),
                      }} aria-hidden="true" />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {item.kind === 'announcement' && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            fontSize: '0.6rem', fontWeight: 600, color: 'var(--warning-600)',
                            textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2,
                          }}>
                            <Megaphone size={9} /> {t('notification.system')}
                          </span>
                        )}
                        <p style={{
                          fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.45,
                          marginBottom: 2, fontWeight: item.isRead ? 400 : 500, wordBreak: 'break-word',
                          margin: 0,
                        }}>{item.text}</p>
                        {item.subtext && (
                          <p style={{
                            fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.4,
                            margin: '2px 0 0',
                          }}>{item.subtext}</p>
                        )}
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{timeAgo(item.createdAt, t)}</span>
                      </div>

                      {/* Actions — only for user notifications */}
                      {item.kind === 'notification' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                          {!item.isRead && (
                            <button
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 24, height: 24, borderRadius: 'var(--radius-sm)',
                                border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)',
                              }}
                              onClick={(e) => { e.stopPropagation(); handleMarkRead(item.rawId); }}
                              title={t('notification.markRead')}
                            >
                              <Check size={13} />
                            </button>
                          )}
                          <button
                            className="notif-delete"
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: 24, height: 24, borderRadius: 'var(--radius-sm)',
                              border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)',
                              opacity: 0, transition: 'opacity 0.15s',
                            }}
                            onClick={(e) => handleDelete(e, item)}
                            title={t('notification.deleteTitle')}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
