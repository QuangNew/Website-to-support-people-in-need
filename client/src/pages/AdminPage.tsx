import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, Shield, FileText, Flag, ScrollText, Megaphone, BarChart3,
  ChevronDown, ChevronRight, RefreshCw, Download, Trash2, Pin, Ban,
  LogOut, Eye,
  ArrowLeft, Search, CheckCircle2, XCircle, AlertTriangle,
  Heart, BookOpen, Stethoscope, Home, Activity, ShieldCheck, Plus, Edit2,
  MapPin, Package, X, Key,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../services/api';
import { VIETNAM_PROVINCES } from '../utils/vietnamProvinces';
import { mapApi, supplyApi } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuthStore } from '../stores/authStore';
import { useBatchStore } from '../stores/batchStore';
import type {
  AdminUser,
  AdminPost,
  SystemLog,
  Report,
  Announcement,
  SystemStats,
  PagedResponse,
} from '../types/admin';

// ─── Debounce utility ───
function debounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

// ─── Auto-refresh hook ───
function useAutoRefresh(refresh: () => void, intervalMs: number) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    const tick = () => refreshRef.current();
    const timer = setInterval(tick, intervalMs);
    const onFocus = () => { if (!document.hidden) refreshRef.current(); };
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [intervalMs]);
}

// ─── CSV download helper ───
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Tab = 'stats' | 'verifications' | 'users' | 'posts' | 'reports' | 'logs' | 'announcements' | 'zones' | 'supply' | 'apikeys';

// ═══════════════════════════════════════════
//  ADMIN PAGE
// ═══════════════════════════════════════════

export default function AdminPage() {
  const { t } = useLanguage();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('stats');

  useEffect(() => {
    if (user && user.role !== 'Admin') {
      navigate('/');
    }
  }, [user, navigate]);

  const tabs: { key: Tab; label: string; icon: typeof BarChart3 }[] = [
    { key: 'stats', label: t('admin.stats'), icon: BarChart3 },
    { key: 'verifications', label: t('admin.verifications'), icon: ShieldCheck },
    { key: 'users', label: t('admin.users'), icon: Users },
    { key: 'posts', label: t('admin.posts'), icon: FileText },
    { key: 'reports', label: 'Reports', icon: Flag },
    { key: 'logs', label: t('admin.logs'), icon: ScrollText },
    { key: 'announcements', label: 'Announcements', icon: Megaphone },
    { key: 'zones', label: 'Zones', icon: MapPin },
    { key: 'supply', label: 'Supply', icon: Package },
    { key: 'apikeys', label: 'API Keys', icon: Key },
  ];

  return (
    <div className="admin-page">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar__header">
          <Heart size={24} className="text-primary" />
          <span className="admin-sidebar__brand">ReliefConnect</span>
        </div>

        <nav className="admin-sidebar__nav">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`admin-nav-btn ${activeTab === tab.key ? 'admin-nav-btn--active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <tab.icon size={18} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <button className="admin-nav-btn admin-nav-btn--back" onClick={() => navigate('/')}>
          <ArrowLeft size={18} />
          <span>{t('admin.backToMap')}</span>
        </button>
      </aside>

      {/* Main content */}
      <main className="admin-main">
        <header className="admin-header">
          <h1>{t('admin.title')}</h1>
          <span className="admin-header__user">{user?.fullName}</span>
        </header>

        <div className="admin-content">
          {activeTab === 'stats' && <StatsPanel />}
          {activeTab === 'verifications' && <VerificationsPanel />}
          {activeTab === 'users' && <UsersPanel />}
          {activeTab === 'posts' && <PostsPanel />}
          {activeTab === 'reports' && <ReportsPanel />}
          {activeTab === 'logs' && <LogsPanel />}
          {activeTab === 'announcements' && <AnnouncementsPanel />}
          {activeTab === 'zones' && <ZonesPanel />}
          {activeTab === 'supply' && <SupplyPanel />}
          {activeTab === 'apikeys' && <ApiKeysPanel />}
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════
//  STATS PANEL
// ═══════════════════════════════════════════

function StatsPanel() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    adminApi.getStats()
      .then((res) => { setStats(res.data); setLastUpdated(new Date()); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const silentRefresh = useCallback(() => {
    adminApi.getStats()
      .then((res) => { setStats(res.data); setLastUpdated(new Date()); })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(silentRefresh, 60_000);

  if (loading) return (
    <div className="animate-fade-in-up">
      <div className="admin-stats-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="admin-stat-card glass-card" style={{ opacity: 0.5 }}>
            <div className="admin-stat-card__icon" style={{ background: 'var(--bg-tertiary)' }} />
            <div className="admin-stat-card__info">
              <span className="admin-stat-card__value" style={{ background: 'var(--bg-tertiary)', borderRadius: 4, color: 'transparent' }}>000</span>
              <span className="admin-stat-card__label" style={{ background: 'var(--bg-tertiary)', borderRadius: 4, color: 'transparent' }}>Loading</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (error) return (
    <div className="admin-empty animate-fade-in-up">
      <AlertTriangle size={48} strokeWidth={1.5} className="text-danger" />
      <p>{t('common.error')}</p>
      <button className="btn btn-secondary btn-sm" onClick={load} style={{ marginTop: 'var(--sp-3)' }}>
        <RefreshCw size={14} /> Retry
      </button>
    </div>
  );

  if (!stats) return null;

  const cards = [
    { label: t('admin.totalUsers'), value: stats.totalUsers, icon: Users, color: 'var(--accent-400)', bg: 'rgba(6, 182, 212, 0.1)' },
    { label: t('admin.personsInNeed'), value: stats.totalPersonsInNeed, icon: AlertTriangle, color: 'var(--danger-500)', bg: 'rgba(239, 68, 68, 0.1)' },
    { label: t('admin.sponsors'), value: stats.totalSponsors, icon: Heart, color: 'var(--primary-400)', bg: 'rgba(249, 115, 22, 0.1)' },
    { label: t('admin.volunteers'), value: stats.totalVolunteers, icon: ShieldCheck, color: 'var(--success-500)', bg: 'rgba(34, 197, 94, 0.1)' },
    { label: t('admin.activeSOS'), value: stats.activeSOS, icon: AlertTriangle, color: 'var(--danger-500)', bg: 'rgba(239, 68, 68, 0.15)' },
    { label: t('admin.resolvedCases'), value: stats.resolvedCases, icon: CheckCircle2, color: 'var(--success-500)', bg: 'rgba(34, 197, 94, 0.15)' },
    { label: 'Pending Verifications', value: stats.pendingVerifications, icon: Shield, color: 'var(--warning-500, #f59e0b)', bg: 'rgba(245, 158, 11, 0.1)' },
    { label: 'Pending Reports', value: stats.pendingReports, icon: Flag, color: 'var(--danger-500)', bg: 'rgba(239, 68, 68, 0.1)' },
  ];

  const postCards = [
    { label: t('admin.totalPosts'), value: stats.totalPosts, icon: FileText, color: 'var(--info-500)', bg: 'rgba(59, 130, 246, 0.1)' },
    { label: t('admin.postsLivelihood'), value: stats.totalPostsLivelihood, icon: Home, color: 'var(--primary-400)', bg: 'rgba(249, 115, 22, 0.1)' },
    { label: t('admin.postsMedical'), value: stats.totalPostsMedical, icon: Stethoscope, color: 'var(--danger-500)', bg: 'rgba(239, 68, 68, 0.1)' },
    { label: t('admin.postsEducation'), value: stats.totalPostsEducation, icon: BookOpen, color: 'var(--accent-400)', bg: 'rgba(6, 182, 212, 0.1)' },
  ];

  return (
    <div className="animate-fade-in-up">
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
        {lastUpdated && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {t('admin.lastUpdated')} {lastUpdated.toLocaleTimeString()}
          </span>
        )}
        <button className="btn btn-ghost btn-sm" onClick={load} title={t('admin.refresh')}>
          <RefreshCw size={13} />
        </button>
      </div>
      <div className="admin-stats-grid">
        {cards.map((c) => (
          <div key={c.label} className="admin-stat-card glass-card">
            <div className="admin-stat-card__icon" style={{ background: c.bg, color: c.color }}>
              <c.icon size={22} />
            </div>
            <div className="admin-stat-card__info">
              <span className="admin-stat-card__value">{c.value}</span>
              <span className="admin-stat-card__label">{c.label}</span>
            </div>
          </div>
        ))}
      </div>
      <h3 style={{ marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-3)', color: 'var(--text-secondary)' }}>
        {t('admin.posts')}
      </h3>
      <div className="admin-stats-grid">
        {postCards.map((c) => (
          <div key={c.label} className="admin-stat-card glass-card">
            <div className="admin-stat-card__icon" style={{ background: c.bg, color: c.color }}>
              <c.icon size={22} />
            </div>
            <div className="admin-stat-card__info">
              <span className="admin-stat-card__value">{c.value}</span>
              <span className="admin-stat-card__label">{c.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  VERIFICATIONS PANEL
// ═══════════════════════════════════════════

function VerificationsPanel() {
  const { t } = useLanguage();
  const { ops, enqueue } = useBatchStore();
  const [serverItems, setServerItems] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getVerifications()
      .then((res) => { setServerItems(res.data); setLastUpdated(new Date()); })
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false));
  }, [t]);

  const silentRefresh = useCallback(() => {
    adminApi.getVerifications()
      .then((res) => { setServerItems(res.data); setLastUpdated(new Date()); })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    window.addEventListener('batch-flush-done', silentRefresh);
    return () => window.removeEventListener('batch-flush-done', silentRefresh);
  }, [silentRefresh]);
  useAutoRefresh(silentRefresh, 60_000);

  const queuedUserIds = new Set(
    ops
      .filter((o) => o.type === 'approveRole' || o.type === 'rejectVerification')
      .map((o) => o.userId!)
  );
  const visibleItems = serverItems.filter((u) => !queuedUserIds.has(u.id));

  const handleApprove = (user: AdminUser) => {
    const role = user.requestedRole || 'PersonInNeed';
    enqueue({
      type: 'approveRole',
      userId: user.id,
      role,
      rollbackLabel: `Approve ${user.fullName} → ${role}`,
    });
    toast(`⏳ Queued: approve ${user.fullName}`, { duration: 2000 });
  };

  const handleReject = (user: AdminUser) => {
    enqueue({
      type: 'rejectVerification',
      userId: user.id,
      rollbackLabel: `Reject ${user.fullName}`,
    });
    toast(`⏳ Queued: reject ${user.fullName}`, { duration: 2000 });
  };

  if (loading) return <div className="admin-loading"><span className="spinner" /></div>;

  if (visibleItems.length === 0) {
    return (
      <div className="admin-empty animate-fade-in-up">
        <ShieldCheck size={48} strokeWidth={1.5} />
        <p>{ops.length > 0 ? t('admin.queuedAll') : t('admin.noPending')}</p>
        {lastUpdated && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--sp-1)' }}>
            {t('admin.lastUpdated')} {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-3)' }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          {visibleItems.length} {t('admin.pendingRequests')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          {lastUpdated && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {t('admin.lastUpdated')} {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={load} title={t('admin.refresh')}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('admin.user')}</th>
              <th>Email</th>
              <th>{t('admin.requestedRole')}</th>
              <th>{t('admin.reason')}</th>
              <th>{t('admin.action')}</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((v) => (
              <tr key={v.id}>
                <td>
                  <div className="admin-user-cell">
                    <div className="admin-avatar" style={{ background: 'var(--bg-subtle)' }}>
                      {v.avatarUrl
                        ? <img src={v.avatarUrl} alt="" />
                        : <span>{v.fullName.charAt(0)}</span>}
                    </div>
                    <div>
                      <div className="admin-user-name">{v.fullName}</div>
                      <div className="admin-user-sub">@{v.userName}</div>
                    </div>
                  </div>
                </td>
                <td>{v.email}</td>
                <td><span className="admin-badge admin-badge--info">{v.requestedRole}</span></td>
                <td className="admin-td-reason">{v.verificationReason || '-'}</td>
                <td>
                  <div className="admin-action-btns">
                    <button className="btn btn-sm btn-primary" onClick={() => handleApprove(v)}>
                      <CheckCircle2 size={14} /> {t('admin.approve')}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleReject(v)}>
                      <XCircle size={14} /> {t('admin.reject')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  USERS PANEL
// ═══════════════════════════════════════════

function UsersPanel() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const debouncedSetSearch = useCallback(
    debounce((value: string) => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300),
    []
  );

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getUsers({ search: debouncedSearch || undefined, role: roleFilter || undefined, page, pageSize: 15 })
      .then((res) => {
        const data: PagedResponse<AdminUser> = res.data;
        setUsers(data.items);
        setTotalPages(data.totalPages);
      })
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false));
  }, [debouncedSearch, roleFilter, page, t]);

  useEffect(() => { load(); }, [load]);

  const handleSuspend = async (userId: string, fullName: string) => {
    const reason = prompt(`Suspend reason for ${fullName}:`);
    if (!reason) return;
    try {
      await adminApi.suspendUser(userId, { reason });
      toast.success(`Suspended ${fullName}`);
      load();
    } catch {
      toast.error(t('common.error'));
    }
  };

  const handleUnsuspend = async (userId: string, fullName: string) => {
    try {
      await adminApi.unsuspendUser(userId);
      toast.success(`Unsuspended ${fullName}`);
      load();
    } catch {
      toast.error(t('common.error'));
    }
  };

  const handleBan = async (userId: string, fullName: string) => {
    const reason = prompt(`Ban reason for ${fullName}:`);
    if (!reason) return;
    try {
      await adminApi.banUser(userId, { reason });
      toast.success(`Banned ${fullName}`);
      load();
    } catch {
      toast.error(t('common.error'));
    }
  };

  const handleForceLogout = async (userId: string, fullName: string) => {
    try {
      await adminApi.forceLogout(userId);
      toast.success(`Force-logged out ${fullName}`);
    } catch {
      toast.error(t('common.error'));
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await adminApi.approveRole(userId, { role });
      toast.success(t('admin.approved'));
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || t('common.error'));
    }
  };

  return (
    <div className="animate-fade-in-up">
      <div className="admin-filters">
        <div className="admin-search">
          <Search size={16} />
          <input
            type="text"
            placeholder={t('admin.searchPlaceholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); debouncedSetSearch(e.target.value); }}
          />
        </div>
        <select
          className="admin-select"
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
        >
          <option value="">{t('admin.allRoles')}</option>
          <option value="Guest">Guest</option>
          <option value="PersonInNeed">PersonInNeed</option>
          <option value="Sponsor">Sponsor</option>
          <option value="Volunteer">Volunteer</option>
          <option value="Admin">Admin</option>
        </select>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={16} /></button>
      </div>

      {loading ? (
        <div className="admin-loading"><span className="spinner" /></div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('admin.user')}</th>
                  <th>Email</th>
                  <th>{t('profile.role')}</th>
                  <th>{t('profile.status')}</th>
                  <th>{t('admin.date')}</th>
                  <th>{t('admin.action')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={u.isSuspended ? { opacity: 0.7 } : undefined}>
                    <td>
                      <div className="admin-user-cell">
                        <div className="admin-avatar" style={{ background: 'var(--bg-subtle)' }}>
                          {u.avatarUrl
                            ? <img src={u.avatarUrl} alt="" />
                            : <span>{u.fullName.charAt(0)}</span>}
                        </div>
                        <div>
                          <div className="admin-user-name">{u.fullName}</div>
                          <div className="admin-user-sub">@{u.userName}</div>
                          {u.isSuspended && (
                            <span className="admin-badge admin-badge--danger" style={{ fontSize: '10px' }}>Suspended</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        className="admin-select admin-select--sm"
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      >
                        <option value="Guest">Guest</option>
                        <option value="PersonInNeed">PersonInNeed</option>
                        <option value="Sponsor">Sponsor</option>
                        <option value="Volunteer">Volunteer</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <span className={`admin-badge admin-badge--${u.verificationStatus.toLowerCase()}`}>
                        {u.verificationStatus}
                      </span>
                    </td>
                    <td className="admin-td-date">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="admin-action-btns" style={{ flexWrap: 'wrap' }}>
                        {u.isSuspended ? (
                          <button
                            className="btn btn-ghost btn-sm"
                            title="Unsuspend"
                            onClick={() => handleUnsuspend(u.id, u.fullName)}
                          >
                            <CheckCircle2 size={14} />
                          </button>
                        ) : (
                          <button
                            className="btn btn-ghost btn-sm btn-danger-text"
                            title="Suspend"
                            onClick={() => handleSuspend(u.id, u.fullName)}
                          >
                            <AlertTriangle size={14} />
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-sm btn-danger-text"
                          title="Ban"
                          onClick={() => handleBan(u.id, u.fullName)}
                        >
                          <Ban size={14} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Force logout"
                          onClick={() => handleForceLogout(u.id, u.fullName)}
                        >
                          <LogOut size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-muted)' }}>{t('admin.noData')}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="admin-pagination">
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
              <span className="admin-page-info">{page} / {totalPages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  POSTS PANEL (content moderation)
// ═══════════════════════════════════════════

function PostsPanel() {
  const { t } = useLanguage();
  const { ops, enqueue } = useBatchStore();
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getPosts({ page, pageSize: 20, category: categoryFilter || undefined })
      .then((res) => {
        const data: PagedResponse<AdminPost> = res.data;
        setPosts(data.items);
        setTotalPages(data.totalPages);
      })
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false));
  }, [page, categoryFilter, t]);

  const silentRefresh = useCallback(() => {
    adminApi.getPosts({ page, pageSize: 20, category: categoryFilter || undefined })
      .then((res) => {
        const data: PagedResponse<AdminPost> = res.data;
        setPosts(data.items);
        setTotalPages(data.totalPages);
      })
      .catch(() => {});
  }, [page, categoryFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    window.addEventListener('batch-flush-done', silentRefresh);
    return () => window.removeEventListener('batch-flush-done', silentRefresh);
  }, [silentRefresh]);

  const queuedPostIds = new Set(
    ops.filter((o) => o.type === 'deletePost').map((o) => o.postId!)
  );
  const visiblePosts = posts.filter((p) => !queuedPostIds.has(p.id));

  const handleDelete = (post: AdminPost) => {
    enqueue({
      type: 'deletePost',
      postId: post.id,
      rollbackLabel: `Delete post #${post.id} by ${post.authorName}`,
    });
    toast(`⏳ Queued: delete post #${post.id}`, { duration: 2000 });
  };

  const handlePin = async (postId: number) => {
    try {
      await adminApi.pinPost(postId);
      toast.success(`Post #${postId} pin toggled`);
      load();
    } catch {
      toast.error(t('common.error'));
    }
  };

  if (loading) return <div className="admin-loading"><span className="spinner" /></div>;

  return (
    <div className="animate-fade-in-up">
      <div className="admin-filters">
        <select
          className="admin-select"
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
        >
          <option value="">{t('admin.allCategories')}</option>
          <option value="Livelihood">{t('admin.postsLivelihood')}</option>
          <option value="Medical">{t('admin.postsMedical')}</option>
          <option value="Education">{t('admin.postsEducation')}</option>
        </select>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={16} /></button>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>{t('admin.user')}</th>
              <th>Content</th>
              <th>Category</th>
              <th>Stats</th>
              <th>{t('admin.date')}</th>
              <th>{t('admin.action')}</th>
            </tr>
          </thead>
          <tbody>
            {visiblePosts.map((p) => (
              <tr key={p.id}>
                <td>#{p.id}</td>
                <td>{p.authorName}</td>
                <td className="admin-td-content">
                  {p.isPinned && <Pin size={12} style={{ color: 'var(--primary-400)', marginRight: 4 }} />}
                  {p.content.substring(0, 100)}{p.content.length > 100 ? '…' : ''}
                </td>
                <td><span className="admin-badge">{p.category}</span></td>
                <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  💬 {p.commentCount} · ❤️ {p.reactionCount}
                </td>
                <td className="admin-td-date">{new Date(p.createdAt).toLocaleDateString()}</td>
                <td>
                  <div className="admin-action-btns">
                    <button
                      className="btn btn-ghost btn-sm"
                      title={p.isPinned ? 'Unpin' : 'Pin'}
                      onClick={() => handlePin(p.id)}
                    >
                      <Pin size={14} />
                    </button>
                    <button className="btn btn-ghost btn-sm btn-danger-text" onClick={() => handleDelete(p)}>
                      <Trash2 size={14} /> {t('admin.delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visiblePosts.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-muted)' }}>
                {ops.length > 0 ? t('admin.queuedAllDelete') : t('admin.noData')}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="admin-pagination">
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <span className="admin-page-info">{page} / {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  REPORTS PANEL
// ═══════════════════════════════════════════

function ReportsPanel() {
  const { t } = useLanguage();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('Pending');

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getReports({ status: statusFilter || undefined, page, pageSize: 20 })
      .then((res) => {
        const data: PagedResponse<Report> = res.data;
        setReports(data.items);
        setTotalPages(data.totalPages);
      })
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false));
  }, [statusFilter, page, t]);

  useEffect(() => { load(); }, [load]);

  const handleReview = async (reportId: number) => {
    try {
      await adminApi.reviewReport(reportId);
      toast.success('Report marked as reviewed');
      load();
    } catch {
      toast.error(t('common.error'));
    }
  };

  const handleDismiss = async (reportId: number) => {
    try {
      await adminApi.dismissReport(reportId);
      toast.success('Report dismissed');
      load();
    } catch {
      toast.error(t('common.error'));
    }
  };

  if (loading) return <div className="admin-loading"><span className="spinner" /></div>;

  return (
    <div className="animate-fade-in-up">
      <div className="admin-filters">
        <select
          className="admin-select"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Reviewed">Reviewed</option>
          <option value="Dismissed">Dismissed</option>
        </select>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={16} /></button>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Post</th>
              <th>Reporter</th>
              <th>Reason</th>
              <th>Status</th>
              <th>{t('admin.date')}</th>
              <th>{t('admin.action')}</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>#{r.id}</td>
                <td className="admin-td-content">
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Post #{r.postId}: </span>
                  {r.postContentPreview.substring(0, 80)}{r.postContentPreview.length > 80 ? '…' : ''}
                </td>
                <td>{r.reporterName}</td>
                <td className="admin-td-content">{r.reason}</td>
                <td>
                  <span className={`admin-badge admin-badge--${r.status.toLowerCase()}`}>{r.status}</span>
                </td>
                <td className="admin-td-date">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td>
                  {r.status === 'Pending' && (
                    <div className="admin-action-btns">
                      <button className="btn btn-ghost btn-sm" title="Mark reviewed" onClick={() => handleReview(r.id)}>
                        <Eye size={14} />
                      </button>
                      <button className="btn btn-ghost btn-sm btn-danger-text" title="Dismiss" onClick={() => handleDismiss(r.id)}>
                        <XCircle size={14} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-muted)' }}>
                No reports found
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="admin-pagination">
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <span className="admin-page-info">{page} / {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  LOGS PANEL  (expandable batch rows)
// ═══════════════════════════════════════════

function LogsPanel() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [childrenMap, setChildrenMap] = useState<Record<number, SystemLog[]>>({});
  const [loadingChildren, setLoadingChildren] = useState<Set<number>>(new Set());
  const [exportingUsers, setExportingUsers] = useState(false);
  const [exportingLogs, setExportingLogs] = useState(false);
  const [detailLog, setDetailLog] = useState<SystemLog | null>(null);
  const pageSize = 30;

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getLogs({
      page,
      pageSize,
      action: actionFilter || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
    })
      .then((res) => {
        const data: PagedResponse<SystemLog> = res.data;
        setLogs(data.items);
        setTotal(data.total);
      })
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false));
  }, [page, actionFilter, fromDate, toDate, t]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / pageSize);

  const toggleExpand = async (logId: number) => {
    const next = new Set(expandedIds);
    if (next.has(logId)) {
      next.delete(logId);
      setExpandedIds(next);
      return;
    }
    next.add(logId);
    setExpandedIds(next);

    if (!childrenMap[logId]) {
      setLoadingChildren((s) => new Set(s).add(logId));
      try {
        const res = await adminApi.getLogChildren(logId);
        setChildrenMap((m) => ({ ...m, [logId]: res.data }));
      } catch {
        toast.error('Failed to load child logs');
      } finally {
        setLoadingChildren((s) => { const ns = new Set(s); ns.delete(logId); return ns; });
      }
    }
  };

  const handleExportUsers = async () => {
    setExportingUsers(true);
    try {
      const res = await adminApi.exportUsersCsv();
      downloadBlob(res.data as Blob, 'users.csv');
      toast.success('Users CSV downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setExportingUsers(false);
    }
  };

  const handleExportLogs = async () => {
    setExportingLogs(true);
    try {
      const res = await adminApi.exportLogsCsv();
      downloadBlob(res.data as Blob, 'logs.csv');
      toast.success('Logs CSV downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setExportingLogs(false);
    }
  };

  if (loading) return <div className="admin-loading"><span className="spinner" /></div>;

  return (
    <div className="animate-fade-in-up">
      <div className="admin-filters" style={{ flexWrap: 'wrap' }}>
        <input
          type="date"
          className="admin-select"
          value={fromDate}
          onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
          placeholder={t('admin.from')}
        />
        <input
          type="date"
          className="admin-select"
          value={toDate}
          onChange={(e) => { setToDate(e.target.value); setPage(1); }}
          placeholder={t('admin.to')}
        />
        <select
          className="admin-select"
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
        >
          <option value="">{t('admin.allActions')}</option>
          <option value="Login">Login</option>
          <option value="Register">Register</option>
          <option value="CreatePost">CreatePost</option>
          <option value="DeletePost">DeletePost</option>
          <option value="ApproveRole">ApproveRole</option>
          <option value="RejectVerification">RejectVerification</option>
          <option value="SuspendUser">SuspendUser</option>
          <option value="BanUser">BanUser</option>
        </select>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={16} /></button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--sp-2)' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleExportUsers}
            disabled={exportingUsers}
            title="Export users CSV"
          >
            <Download size={14} /> {exportingUsers ? '…' : 'Users CSV'}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleExportLogs}
            disabled={exportingLogs}
            title="Export logs CSV"
          >
            <Download size={14} /> {exportingLogs ? '…' : 'Logs CSV'}
          </button>
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}></th>
              <th>ID</th>
              <th>{t('admin.action')}</th>
              <th>{t('admin.details')}</th>
              <th>{t('admin.user')}</th>
              <th>{t('admin.date')}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <>
                <tr key={l.id} style={l.hasChildren ? { cursor: 'pointer' } : undefined}
                  onClick={() => { if (l.hasChildren) toggleExpand(l.id); else setDetailLog(l); }}>
                  <td>
                    {l.hasChildren && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 4px' }}
                        onClick={() => toggleExpand(l.id)}
                        title={expandedIds.has(l.id) ? 'Collapse' : 'Expand children'}
                      >
                        {loadingChildren.has(l.id)
                          ? <span className="spinner" style={{ width: 12, height: 12 }} />
                          : expandedIds.has(l.id)
                            ? <ChevronDown size={14} />
                            : <ChevronRight size={14} />}
                      </button>
                    )}
                  </td>
                  <td>#{l.id}</td>
                  <td><span className="admin-badge admin-badge--action">{l.action}</span></td>
                  <td className="admin-td-content">{l.details || '-'}</td>
                  <td>{l.userName || '-'}</td>
                  <td className="admin-td-date">{new Date(l.createdAt).toLocaleString()}</td>
                </tr>
                {expandedIds.has(l.id) && childrenMap[l.id]?.map((child) => (
                  <tr
                    key={`child-${child.id}`}
                    style={{ background: 'var(--bg-subtle, rgba(0,0,0,0.04))', cursor: 'pointer' }}
                    onClick={() => setDetailLog(child)}
                    title="Click to view details"
                  >
                    <td></td>
                    <td>
                      <div style={{
                        paddingLeft: 'var(--sp-4)',
                        borderLeft: '2px solid var(--accent-400, #06b6d4)',
                        color: 'var(--text-muted)',
                        fontSize: 'var(--text-xs)',
                      }}>
                        #{child.id}
                      </div>
                    </td>
                    <td>
                      <span className="admin-badge admin-badge--action" style={{ opacity: 0.75 }}>
                        {child.action}
                      </span>
                    </td>
                    <td className="admin-td-content" style={{ color: 'var(--text-secondary)' }}>
                      {child.details
                        ? child.details.length > 80 ? child.details.slice(0, 80) + '…' : child.details
                        : '-'}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{child.userName || '-'}</td>
                    <td className="admin-td-date" style={{ color: 'var(--text-muted)' }}>
                      {new Date(child.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-muted)' }}>{t('admin.noData')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="admin-pagination">
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <span className="admin-page-info">{page} / {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}

      {/* Log detail overlay */}
      {detailLog && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setDetailLog(null)}
        >
          <div
            className="glass-card animate-fade-in"
            style={{
              padding: 'var(--sp-6)', maxWidth: 560, width: '90%', maxHeight: '80vh', overflow: 'auto',
              borderRadius: 'var(--radius-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
              <h4 style={{ margin: 0 }}>Log #{detailLog.id}</h4>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetailLog(null)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>Action</div>
                <span className="admin-badge admin-badge--action">{detailLog.action}</span>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>User</div>
                <div style={{ fontWeight: 500 }}>{detailLog.userName || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>Date</div>
                <div>{new Date(detailLog.createdAt).toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>Details</div>
                <div style={{
                  background: 'var(--bg-subtle, rgba(0,0,0,0.04))', padding: 'var(--sp-3)',
                  borderRadius: 'var(--radius-md)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  fontFamily: 'monospace', fontSize: 'var(--text-sm)', lineHeight: 1.6,
                }}>
                  {detailLog.details || 'No details available.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  ANNOUNCEMENTS PANEL
// ═══════════════════════════════════════════

interface AnnouncementFormState {
  title: string;
  content: string;
  expiresAt: string;
}

const emptyForm: AnnouncementFormState = { title: '', content: '', expiresAt: '' };

function AnnouncementsPanel() {
  const { t } = useLanguage();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AnnouncementFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getAnnouncements({ page, pageSize: 20 })
      .then((res) => {
        const data: PagedResponse<Announcement> = res.data;
        setAnnouncements(data.items);
        setTotalPages(data.totalPages);
      })
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false));
  }, [page, t]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (a: Announcement) => {
    setEditingId(a.id);
    setForm({
      title: a.title,
      content: a.content,
      expiresAt: a.expiresAt ? a.expiresAt.substring(0, 16) : '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        expiresAt: form.expiresAt || undefined,
      };
      if (editingId !== null) {
        await adminApi.updateAnnouncement(editingId, payload);
        toast.success('Announcement updated');
      } else {
        await adminApi.createAnnouncement(payload);
        toast.success('Announcement created');
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await adminApi.deleteAnnouncement(id);
      toast.success('Announcement deleted');
      load();
    } catch {
      toast.error(t('common.error'));
    }
  };

  if (loading) return <div className="admin-loading"><span className="spinner" /></div>;

  return (
    <div className="animate-fade-in-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
        <h3 style={{ margin: 0 }}>System Announcements</h3>
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={16} /></button>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} /> New Announcement
          </button>
        </div>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="glass-card" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)', borderRadius: 'var(--radius-lg)' }}>
          <h4 style={{ marginBottom: 'var(--sp-3)', marginTop: 0 }}>
            {editingId !== null ? 'Edit Announcement' : 'New Announcement'}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <input
              type="text"
              className="admin-select"
              placeholder="Title *"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              style={{ width: '100%' }}
            />
            <textarea
              className="admin-select"
              placeholder="Content *"
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              rows={4}
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                Expires at (optional):
              </label>
              <input
                type="datetime-local"
                className="admin-select"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setShowForm(false); setForm(emptyForm); setEditingId(null); }}
                disabled={saving}
              >
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
                {saving ? 'Saving…' : editingId !== null ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Content</th>
              <th>Author</th>
              <th>Expires</th>
              <th>Status</th>
              <th>{t('admin.action')}</th>
            </tr>
          </thead>
          <tbody>
            {announcements.map((a) => (
              <tr key={a.id} style={a.isExpired ? { opacity: 0.6 } : undefined}>
                <td>#{a.id}</td>
                <td style={{ fontWeight: 600, maxWidth: 160 }}>{a.title}</td>
                <td className="admin-td-content">
                  {a.content.substring(0, 100)}{a.content.length > 100 ? '…' : ''}
                </td>
                <td>{a.adminName}</td>
                <td className="admin-td-date">
                  {a.expiresAt ? new Date(a.expiresAt).toLocaleDateString() : '—'}
                </td>
                <td>
                  <span className={`admin-badge admin-badge--${a.isExpired ? 'danger' : 'success'}`}>
                    {a.isExpired ? 'Expired' : 'Active'}
                  </span>
                </td>
                <td>
                  <div className="admin-action-btns">
                    <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => openEdit(a)}>
                      <Edit2 size={14} />
                    </button>
                    <button className="btn btn-ghost btn-sm btn-danger-text" title="Delete" onClick={() => handleDelete(a.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {announcements.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-muted)' }}>
                No announcements yet
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="admin-pagination">
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <span className="admin-page-info">{page} / {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}

// ─── Unused icon suppression (keeps imports clean for future use) ───
void Activity;
void Shield;

// ═══════════════════════════════════════════
//  ZONES PANEL
// ═══════════════════════════════════════════

interface ZoneRow {
  id: number;
  name: string;
  boundaryGeoJson: string;
  riskLevel: number;
  createdAt: string;
}

interface ZoneFormState {
  name: string;
  boundaryGeoJson: string;
  riskLevel: number;
}

const emptyZoneForm: ZoneFormState = { name: '', boundaryGeoJson: '', riskLevel: 1 };

function ZonesPanel() {
  const { t } = useLanguage();
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ZoneFormState>(emptyZoneForm);
  const [saving, setSaving] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    mapApi.getZones()
      .then((res) => setZones(res.data as ZoneRow[]))
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyZoneForm);
    setSelectedProvince('');
    setShowForm(true);
  };

  const openEdit = (z: ZoneRow) => {
    setEditingId(z.id);
    setForm({ name: z.name, boundaryGeoJson: z.boundaryGeoJson, riskLevel: z.riskLevel });
    setSelectedProvince('');
    setShowForm(true);
  };

  const handleProvinceSelect = (provinceName: string) => {
    setSelectedProvince(provinceName);
    if (!provinceName) return;
    const province = VIETNAM_PROVINCES.find((p) => p.name === provinceName);
    if (province) {
      setForm((f) => ({
        ...f,
        name: province.nameVi,
        boundaryGeoJson: province.boundaryGeoJson,
      }));
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.boundaryGeoJson.trim()) {
      toast.error('Name and boundary GeoJSON are required');
      return;
    }
    setSaving(true);
    try {
      if (editingId !== null) {
        await mapApi.updateZone(editingId, form);
        toast.success('Zone updated');
      } else {
        await mapApi.createZone(form);
        toast.success('Zone created');
      }
      setShowForm(false);
      setForm(emptyZoneForm);
      setEditingId(null);
      load();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this zone?')) return;
    try {
      await mapApi.deleteZone(id);
      toast.success('Zone deleted');
      load();
    } catch {
      toast.error(t('common.error'));
    }
  };

  const riskLabel = (level: number) => {
    const labels: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical', 5: 'Extreme' };
    return labels[level] || String(level);
  };

  const riskBadgeClass = (level: number) => {
    if (level >= 4) return 'admin-badge--danger';
    if (level >= 3) return 'admin-badge--warning';
    return 'admin-badge--success';
  };

  if (loading) return <div className="admin-loading"><span className="spinner" /></div>;

  return (
    <div className="animate-fade-in-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
        <h3 style={{ margin: 0 }}>Priority Zones</h3>
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={16} /></button>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} /> New Zone
          </button>
        </div>
      </div>

      {showForm && (
        <div className="glass-card" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)', borderRadius: 'var(--radius-lg)' }}>
          <h4 style={{ marginBottom: 'var(--sp-3)', marginTop: 0 }}>
            {editingId !== null ? 'Edit Zone' : 'New Zone'}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {editingId === null && (
              <div>
                <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--sp-1)' }}>
                  Select Province / City:
                </label>
                <select
                  className="admin-select"
                  value={selectedProvince}
                  onChange={(e) => handleProvinceSelect(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">— Choose a province/city —</option>
                  {VIETNAM_PROVINCES.map((p) => (
                    <option key={p.name} value={p.name}>{p.nameVi}</option>
                  ))}
                </select>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 'var(--sp-1) 0 0' }}>
                  Or enter custom name and GeoJSON below.
                </p>
              </div>
            )}
            <input
              type="text"
              className="admin-select"
              placeholder="Zone name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              style={{ width: '100%' }}
            />
            <textarea
              className="admin-select"
              placeholder="Boundary GeoJSON *"
              value={form.boundaryGeoJson}
              onChange={(e) => setForm((f) => ({ ...f, boundaryGeoJson: e.target.value }))}
              rows={4}
              style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Risk Level:</label>
              <select
                className="admin-select"
                value={form.riskLevel}
                onChange={(e) => setForm((f) => ({ ...f, riskLevel: Number(e.target.value) }))}
              >
                <option value={1}>1 — Low</option>
                <option value={2}>2 — Medium</option>
                <option value={3}>3 — High</option>
                <option value={4}>4 — Critical</option>
                <option value={5}>5 — Extreme</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setForm(emptyZoneForm); setEditingId(null); }} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
                {saving ? 'Saving…' : editingId !== null ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Risk Level</th>
              <th>Created</th>
              <th>{t('admin.action')}</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.id}>
                <td>#{z.id}</td>
                <td style={{ fontWeight: 600 }}>{z.name}</td>
                <td><span className={`admin-badge ${riskBadgeClass(z.riskLevel)}`}>{riskLabel(z.riskLevel)}</span></td>
                <td className="admin-td-date">{new Date(z.createdAt).toLocaleDateString()}</td>
                <td>
                  <div className="admin-action-btns">
                    <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => openEdit(z)}><Edit2 size={14} /></button>
                    <button className="btn btn-ghost btn-sm btn-danger-text" title="Delete" onClick={() => handleDelete(z.id)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {zones.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-muted)' }}>No zones configured yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  SUPPLY PANEL
// ═══════════════════════════════════════════

interface SupplyRow {
  id: number;
  name: string;
  quantity: number;
  lat: number;
  lng: number;
  createdAt: string;
}

interface SupplyFormState {
  name: string;
  quantity: number;
  lat: number;
  lng: number;
}

const emptySupplyForm: SupplyFormState = { name: '', quantity: 0, lat: 0, lng: 0 };

function SupplyPanel() {
  const { t } = useLanguage();
  const [supplies, setSupplies] = useState<SupplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SupplyFormState>(emptySupplyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    supplyApi.getSupplies()
      .then((res) => setSupplies(res.data as SupplyRow[]))
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptySupplyForm);
    setShowForm(true);
  };

  const openEdit = (s: SupplyRow) => {
    setEditingId(s.id);
    setForm({ name: s.name, quantity: s.quantity, lat: s.lat, lng: s.lng });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Supply name is required');
      return;
    }
    if (form.quantity < 0) {
      toast.error('Quantity must be non-negative');
      return;
    }
    setSaving(true);
    try {
      if (editingId !== null) {
        await supplyApi.updateSupply(editingId, { name: form.name, quantity: form.quantity });
        toast.success('Supply updated');
      } else {
        await supplyApi.createSupply(form);
        toast.success('Supply created');
      }
      setShowForm(false);
      setForm(emptySupplyForm);
      setEditingId(null);
      load();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this supply item?')) return;
    try {
      await supplyApi.deleteSupply(id);
      toast.success('Supply deleted');
      load();
    } catch {
      toast.error(t('common.error'));
    }
  };

  if (loading) return <div className="admin-loading"><span className="spinner" /></div>;

  return (
    <div className="animate-fade-in-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
        <h3 style={{ margin: 0 }}>Supply Items</h3>
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={16} /></button>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} /> New Supply
          </button>
        </div>
      </div>

      {showForm && (
        <div className="glass-card" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)', borderRadius: 'var(--radius-lg)' }}>
          <h4 style={{ marginBottom: 'var(--sp-3)', marginTop: 0 }}>
            {editingId !== null ? 'Edit Supply' : 'New Supply'}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <input
              type="text"
              className="admin-select"
              placeholder="Supply name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Quantity</label>
                <input
                  type="number"
                  className="admin-select"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                  min={0}
                  style={{ width: '100%' }}
                />
              </div>
              {editingId === null && (
                <>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Latitude</label>
                    <input
                      type="number"
                      className="admin-select"
                      value={form.lat}
                      onChange={(e) => setForm((f) => ({ ...f, lat: Number(e.target.value) }))}
                      step={0.0001}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Longitude</label>
                    <input
                      type="number"
                      className="admin-select"
                      value={form.lng}
                      onChange={(e) => setForm((f) => ({ ...f, lng: Number(e.target.value) }))}
                      step={0.0001}
                      style={{ width: '100%' }}
                    />
                  </div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setForm(emptySupplyForm); setEditingId(null); }} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
                {saving ? 'Saving…' : editingId !== null ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Quantity</th>
              <th>Coordinates</th>
              <th>Created</th>
              <th>{t('admin.action')}</th>
            </tr>
          </thead>
          <tbody>
            {supplies.map((s) => (
              <tr key={s.id}>
                <td>#{s.id}</td>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td>{s.quantity}</td>
                <td className="admin-td-date">{s.lat.toFixed(4)}, {s.lng.toFixed(4)}</td>
                <td className="admin-td-date">{new Date(s.createdAt).toLocaleDateString()}</td>
                <td>
                  <div className="admin-action-btns">
                    <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => openEdit(s)}><Edit2 size={14} /></button>
                    <button className="btn btn-ghost btn-sm btn-danger-text" title="Delete" onClick={() => handleDelete(s.id)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {supplies.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-muted)' }}>No supply items yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  API KEYS PANEL
// ═══════════════════════════════════════════

interface ApiKeyRow {
  id: number;
  provider: string;
  label: string;
  maskedKey: string;
  model: string;
  isActive: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
}

const PROVIDERS = ['Gemini', 'Claude', 'GPT'] as const;

const emptyKeyForm = { provider: 'Gemini' as string, label: '', keyValue: '', model: '' };

function ApiKeysPanel() {
  const { t } = useLanguage();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyKeyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getApiKeys()
      .then((res) => setKeys(res.data as ApiKeyRow[]))
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyKeyForm);
    setShowForm(true);
  };

  const openEdit = (k: ApiKeyRow) => {
    setEditingId(k.id);
    setForm({ provider: k.provider, label: k.label, keyValue: '', model: k.model });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.label.trim() || !form.model.trim()) {
      toast.error('Label and Model are required');
      return;
    }
    if (editingId === null && !form.keyValue.trim()) {
      toast.error('API key value is required');
      return;
    }
    setSaving(true);
    try {
      if (editingId !== null) {
        const payload: Record<string, unknown> = { label: form.label, model: form.model };
        if (form.keyValue.trim()) payload.keyValue = form.keyValue;
        await adminApi.updateApiKey(editingId, payload as Parameters<typeof adminApi.updateApiKey>[1]);
        toast.success('API key updated');
      } else {
        await adminApi.createApiKey(form);
        toast.success('API key created');
      }
      setShowForm(false);
      setForm(emptyKeyForm);
      setEditingId(null);
      load();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (k: ApiKeyRow) => {
    try {
      await adminApi.updateApiKey(k.id, { isActive: !k.isActive });
      toast.success(k.isActive ? 'Key deactivated' : 'Key activated');
      load();
    } catch {
      toast.error(t('common.error'));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this API key permanently?')) return;
    try {
      await adminApi.deleteApiKey(id);
      toast.success('API key deleted');
      load();
    } catch {
      toast.error(t('common.error'));
    }
  };

  const providerColor = (p: string) => {
    switch (p) {
      case 'Gemini': return '#4285F4';
      case 'Claude': return '#D97706';
      case 'GPT': return '#10A37F';
      default: return 'var(--text-secondary)';
    }
  };

  if (loading) return <div className="admin-loading"><span className="spinner" /> Loading…</div>;

  return (
    <div className="animate-fade-in-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
        <div>
          <h2 style={{ margin: 0 }}>API Key Pool</h2>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Manage API keys for AI providers. Active keys are used in round-robin.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> Refresh</button>
          <button className="btn btn-primary btn-sm" onClick={openCreate}><Plus size={14} /> Add Key</button>
        </div>
      </div>

      {showForm && (
        <div className="glass-card" style={{ marginBottom: 'var(--sp-4)', padding: 'var(--sp-4)' }}>
          <h3 style={{ margin: '0 0 var(--sp-3) 0' }}>{editingId !== null ? 'Edit API Key' : 'Add API Key'}</h3>
          <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Provider</label>
              <select
                className="admin-select"
                value={form.provider}
                onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
                disabled={editingId !== null}
                style={{ width: '100%' }}
              >
                {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Label</label>
              <input
                className="admin-select"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Main Gemini Key"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ flex: 2, minWidth: 200 }}>
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                API Key {editingId !== null && '(leave blank to keep current)'}
              </label>
              <input
                className="admin-select"
                type="password"
                value={form.keyValue}
                onChange={(e) => setForm((f) => ({ ...f, keyValue: e.target.value }))}
                placeholder={editingId !== null ? '••••••••' : 'Paste API key here'}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Model</label>
              <input
                className="admin-select"
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                placeholder="e.g. gemini-2.5-flash"
                style={{ width: '100%' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'flex-end', marginTop: 'var(--sp-3)' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setForm(emptyKeyForm); setEditingId(null); }} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
              {saving ? 'Saving…' : editingId !== null ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Label</th>
              <th>Masked Key</th>
              <th>Model</th>
              <th>Status</th>
              <th>Usage</th>
              <th>Last Used</th>
              <th>{t('admin.action')}</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} style={{ opacity: k.isActive ? 1 : 0.55 }}>
                <td>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: '#fff',
                    background: providerColor(k.provider),
                  }}>
                    {k.provider}
                  </span>
                </td>
                <td style={{ fontWeight: 600 }}>{k.label}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>{k.maskedKey}</td>
                <td style={{ fontSize: 'var(--text-sm)' }}>{k.model}</td>
                <td>
                  <button
                    className={`btn btn-sm ${k.isActive ? 'btn-ghost' : 'btn-ghost'}`}
                    style={{ color: k.isActive ? 'var(--success)' : 'var(--text-muted)' }}
                    onClick={() => handleToggle(k)}
                    title={k.isActive ? 'Click to deactivate' : 'Click to activate'}
                  >
                    {k.isActive ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {k.isActive ? ' Active' : ' Inactive'}
                  </button>
                </td>
                <td style={{ textAlign: 'center' }}>{k.usageCount.toLocaleString()}</td>
                <td className="admin-td-date">
                  {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : '—'}
                </td>
                <td>
                  <div className="admin-action-btns">
                    <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => openEdit(k)}><Edit2 size={14} /></button>
                    <button className="btn btn-ghost btn-sm btn-danger-text" title="Delete" onClick={() => handleDelete(k.id)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-muted)' }}>No API keys configured. Add one to get started.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
