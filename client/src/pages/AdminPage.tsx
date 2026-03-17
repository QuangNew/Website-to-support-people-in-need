import { useState, useEffect, useCallback } from 'react';
import {
  Users, FileText, Activity, BarChart3, ShieldCheck, ArrowLeft,
  Search, CheckCircle2, XCircle, Trash2, RefreshCw, AlertTriangle, Heart, BookOpen, Stethoscope, Home
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { adminApi, socialApi } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuthStore } from '../stores/authStore';

// ═══════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════

interface AdminUser {
  id: string;
  userName: string;
  email: string;
  fullName: string;
  role: string;
  verificationStatus: string;
  requestedRole?: string;
  verificationReason?: string;
  emailVerified: boolean;
  avatarUrl?: string;
  createdAt: string;
}

interface Stats {
  totalUsers: number;
  totalPersonsInNeed: number;
  totalSponsors: number;
  totalVolunteers: number;
  activeSOS: number;
  resolvedCases: number;
  totalPosts: number;
  totalPostsLivelihood: number;
  totalPostsMedical: number;
  totalPostsEducation: number;
}

interface LogEntry {
  id: number;
  action: string;
  details?: string;
  userId?: string;
  userName?: string;
  createdAt: string;
}

interface PostItem {
  id: number;
  content: string;
  category: string;
  authorName: string;
  createdAt: string;
}

type Tab = 'stats' | 'users' | 'verifications' | 'posts' | 'logs';

// ═══════════════════════════════════════════
//  ADMIN PAGE
// ═══════════════════════════════════════════

export default function AdminPage() {
  const { t } = useLanguage();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('stats');

  // Redirect non-admin users
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
    { key: 'logs', label: t('admin.logs'), icon: Activity },
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
          {activeTab === 'logs' && <LogsPanel />}
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
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    adminApi.getStats()
      .then((res) => { if (mounted) setStats(res.data); })
      .catch(() => { if (mounted) toast.error(t('common.error')); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="admin-loading"><span className="spinner" /></div>;
  if (!stats) return null;

  const cards = [
    { label: t('admin.totalUsers'), value: stats.totalUsers, icon: Users, color: 'var(--accent-400)', bg: 'rgba(6, 182, 212, 0.1)' },
    { label: t('admin.personsInNeed'), value: stats.totalPersonsInNeed, icon: AlertTriangle, color: 'var(--danger-500)', bg: 'rgba(239, 68, 68, 0.1)' },
    { label: t('admin.sponsors'), value: stats.totalSponsors, icon: Heart, color: 'var(--primary-400)', bg: 'rgba(249, 115, 22, 0.1)' },
    { label: t('admin.volunteers'), value: stats.totalVolunteers, icon: ShieldCheck, color: 'var(--success-500)', bg: 'rgba(34, 197, 94, 0.1)' },
    { label: t('admin.activeSOS'), value: stats.activeSOS, icon: AlertTriangle, color: 'var(--danger-500)', bg: 'rgba(239, 68, 68, 0.15)' },
    { label: t('admin.resolvedCases'), value: stats.resolvedCases, icon: CheckCircle2, color: 'var(--success-500)', bg: 'rgba(34, 197, 94, 0.15)' },
  ];

  const postCards = [
    { label: t('admin.totalPosts'), value: stats.totalPosts, icon: FileText, color: 'var(--info-500)', bg: 'rgba(59, 130, 246, 0.1)' },
    { label: 'Gia cảnh', value: stats.totalPostsLivelihood, icon: Home, color: 'var(--primary-400)', bg: 'rgba(249, 115, 22, 0.1)' },
    { label: 'Bệnh tật', value: stats.totalPostsMedical, icon: Stethoscope, color: 'var(--danger-500)', bg: 'rgba(239, 68, 68, 0.1)' },
    { label: 'Giáo dục', value: stats.totalPostsEducation, icon: BookOpen, color: 'var(--accent-400)', bg: 'rgba(6, 182, 212, 0.1)' },
  ];

  return (
    <div className="animate-fade-in-up">
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
  const [verifications, setVerifications] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getVerifications()
      .then((res) => setVerifications(res.data))
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (user: AdminUser) => {
    const role = user.requestedRole || 'PersonInNeed';
    if (!confirm(t('admin.confirmApprove'))) return;
    try {
      await adminApi.approveRole(user.id, { role });
      toast.success(t('admin.approved'));
      load();
    } catch {
      toast.error(t('common.error'));
    }
  };

  const handleReject = async (userId: string) => {
    if (!confirm(t('admin.confirmReject'))) return;
    try {
      await adminApi.rejectVerification(userId);
      toast.success(t('admin.rejected'));
      load();
    } catch {
      toast.error(t('common.error'));
    }
  };

  if (loading) return <div className="admin-loading"><span className="spinner" /></div>;

  if (verifications.length === 0) {
    return (
      <div className="admin-empty animate-fade-in-up">
        <ShieldCheck size={48} strokeWidth={1.5} />
        <p>{t('admin.noPending')}</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
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
            {verifications.map((v) => (
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
                    <button className="btn btn-sm btn-danger" onClick={() => handleReject(v.id)}>
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
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getUsers({ search: search || undefined, role: roleFilter || undefined, page, pageSize: 15 })
      .then((res) => {
        setUsers(res.data.items);
        setTotalPages(res.data.totalPages);
      })
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false));
  }, [search, roleFilter, page, t]);

  useEffect(() => { load(); }, [load]);

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await adminApi.approveRole(userId, { role });
      toast.success(t('admin.approved'));
      load();
    } catch {
      toast.error(t('common.error'));
    }
  };

  return (
    <div className="animate-fade-in-up">
      {/* Filters */}
      <div className="admin-filters">
        <div className="admin-search">
          <Search size={16} />
          <input
            type="text"
            placeholder={t('admin.searchPlaceholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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
                  <tr key={u.id}>
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
                      {u.emailVerified
                        ? <CheckCircle2 size={16} className="text-success" />
                        : <XCircle size={16} className="text-danger" />}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-muted)' }}>{t('admin.noData')}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    socialApi.getPosts({ limit: 50 })
      .then((res) => setPosts(res.data.items || res.data))
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (postId: number) => {
    if (!confirm(t('admin.confirmDelete'))) return;
    try {
      await adminApi.deletePost(postId);
      toast.success(t('admin.delete'));
      load();
    } catch {
      toast.error(t('common.error'));
    }
  };

  if (loading) return <div className="admin-loading"><span className="spinner" /></div>;

  return (
    <div className="animate-fade-in-up">
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>{t('admin.user')}</th>
              <th>Content</th>
              <th>Category</th>
              <th>{t('admin.date')}</th>
              <th>{t('admin.action')}</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id}>
                <td>#{p.id}</td>
                <td>{p.authorName}</td>
                <td className="admin-td-content">{p.content.substring(0, 100)}{p.content.length > 100 ? '…' : ''}</td>
                <td><span className="admin-badge">{p.category}</span></td>
                <td className="admin-td-date">{new Date(p.createdAt).toLocaleDateString()}</td>
                <td>
                  <button className="btn btn-ghost btn-sm btn-danger-text" onClick={() => handleDelete(p.id)}>
                    <Trash2 size={14} /> {t('admin.delete')}
                  </button>
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-muted)' }}>{t('admin.noData')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  LOGS PANEL
// ═══════════════════════════════════════════

function LogsPanel() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 30;

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getLogs({ page, pageSize })
      .then((res) => {
        setLogs(res.data.items);
        setTotal(res.data.total);
      })
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false));
  }, [page, t]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / pageSize);

  if (loading) return <div className="admin-loading"><span className="spinner" /></div>;

  return (
    <div className="animate-fade-in-up">
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>{t('admin.action')}</th>
              <th>{t('admin.details')}</th>
              <th>{t('admin.user')}</th>
              <th>{t('admin.date')}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>#{l.id}</td>
                <td><span className="admin-badge admin-badge--action">{l.action}</span></td>
                <td className="admin-td-content">{l.details || '-'}</td>
                <td>{l.userName || '-'}</td>
                <td className="admin-td-date">{new Date(l.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-muted)' }}>{t('admin.noData')}</td></tr>
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
