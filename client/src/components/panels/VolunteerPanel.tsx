import { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle,
  ClipboardList,
  CheckCircle2,
  Clock,
  Inbox,
  MapPin,
  Loader2,
  Navigation,
  ClipboardCheck,
  FileText,
  ShieldCheck,
  History,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { volunteerApi } from '../../services/api';
import { useMapStore } from '../../stores/mapStore';
import { useLanguage } from '../../contexts/LanguageContext';

interface TaskItem {
  id: number;
  lat: number;
  lng: number;
  details: string | null;
  priorityLevel: number;
  createdAt: string;
  userName: string | null;
  status?: string;
  completionNotes?: string | null;
}

interface VolunteerStats {
  totalAcceptedTasks: number;
  activeTasks: number;
  completedTasks: number;
  verifiedSafeTasks: number;
  highPriorityActiveTasks: number;
}

type TabType = 'available' | 'active' | 'history';

const emptyStats: VolunteerStats = {
  totalAcceptedTasks: 0,
  activeTasks: 0,
  completedTasks: 0,
  verifiedSafeTasks: 0,
  highPriorityActiveTasks: 0,
};

export default function VolunteerPanel() {
  const { selectPing, setActivePanel, setFlyTo, fetchRoute } = useMapStore();
  const { t } = useLanguage();

  const [tab, setTab] = useState<TabType>('available');
  const [available, setAvailable] = useState<TaskItem[]>([]);
  const [active, setActive] = useState<TaskItem[]>([]);
  const [history, setHistory] = useState<TaskItem[]>([]);
  const [stats, setStats] = useState<VolunteerStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [completingTask, setCompletingTask] = useState<TaskItem | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completing, setCompleting] = useState(false);

  const fetchAvailable = useCallback(async () => {
    try {
      // Try to use current location for proximity sorting
      let params: { lat?: number; lng?: number } = {};
      if (navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              params = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              resolve();
            },
            () => resolve(),
            { timeout: 5000 }
          );
        });
      }
      const res = await volunteerApi.getAvailableTasks(params);
      setAvailable(res.data as TaskItem[]);
    } catch {
      // Silent fail
    }
  }, []);

  const fetchActive = useCallback(async () => {
    try {
      const res = await volunteerApi.getActiveTasks();
      setActive(res.data as TaskItem[]);
    } catch {
      // Silent fail
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await volunteerApi.getTaskHistory();
      setHistory(res.data as TaskItem[]);
    } catch {
      // Silent fail
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await volunteerApi.getStats();
      setStats(res.data as VolunteerStats);
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchAvailable(), fetchActive(), fetchHistory(), fetchStats()]).finally(() => setLoading(false));
  }, [fetchAvailable, fetchActive, fetchHistory, fetchStats]);

  const handleAcceptTask = async (pingId: number) => {
    try {
      setAcceptingId(pingId);
      await volunteerApi.acceptTask({ pingId });
      toast.success(t('volunteerPanel.accepted'));
      // Move from available to active
      const accepted = available.find((t) => t.id === pingId);
      if (accepted) {
        setAvailable((prev) => prev.filter((t) => t.id !== pingId));
        setActive((prev) => [{ ...accepted, status: 'InProgress' }, ...prev]);
      }
      void fetchStats();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setAcceptingId(null);
    }
  };

  const handleCompleteTask = async () => {
    if (!completingTask) return;

    try {
      setCompleting(true);
      await volunteerApi.completeTask(completingTask.id, {
        completionNotes: completionNotes.trim() || undefined,
      });

      const completedTask = {
        ...completingTask,
        status: 'Resolved',
        completionNotes: completionNotes.trim() || null,
      };

      setActive((prev) => prev.filter((task) => task.id !== completingTask.id));
      setHistory((prev) => [completedTask, ...prev]);
      setCompletingTask(null);
      setCompletionNotes('');
      toast.success(t('volunteerPanel.completeSuccess'));
      void fetchStats();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setCompleting(false);
    }
  };

  const handleViewOnMap = (task: TaskItem) => {
    setFlyTo({ lat: task.lat, lng: task.lng, zoom: 15 });
    selectPing(String(task.id));
    setActivePanel(null);
  };

  const handleGetDirections = (task: TaskItem) => {
    fetchRoute(task.lat, task.lng);
    setFlyTo({ lat: task.lat, lng: task.lng, zoom: 13 });
    setActivePanel(null);
  };

  const currentItems = tab === 'available' ? available : tab === 'active' ? active : history;

  const statCards = [
    { key: 'accepted', icon: ClipboardList, label: t('volunteerPanel.statsAccepted'), value: stats.totalAcceptedTasks, color: 'var(--primary-500)' },
    { key: 'active', icon: ClipboardCheck, label: t('volunteerPanel.statsActive'), value: stats.activeTasks, color: 'var(--warning-500)' },
    { key: 'completed', icon: CheckCircle2, label: t('volunteerPanel.statsCompleted'), value: stats.completedTasks, color: 'var(--success-500)' },
    { key: 'verified', icon: ShieldCheck, label: t('volunteerPanel.statsVerifiedSafe'), value: stats.verifiedSafeTasks, color: 'var(--accent-500)' },
  ];

  if (loading) {
    return (
      <div className="panel-content">
        <div className="panel-header">
          <h2 className="panel-title">{t('volunteerPanel.title')}</h2>
        </div>
        <div className="empty-state">
          <Loader2 size={32} className="animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="panel-content">
      <div className="panel-header">
        <h2 className="panel-title">{t('volunteerPanel.title')}</h2>
        <span className="badge badge-primary">{currentItems.length}</span>
      </div>

      <div style={{ padding: '0 1rem', marginBottom: '0.75rem' }}>
        <div className="panel-stat-grid">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.key} style={{ border: '1px solid var(--border-default)', borderRadius: '10px', padding: '0.75rem', background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{card.label}</span>
                  <Icon size={14} style={{ color: card.color }} />
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{card.value}</div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          {t('volunteerPanel.statsHighPriority')}: <strong>{stats.highPriorityActiveTasks}</strong>
        </div>
      </div>

      {/* Tabs */}
      <div className="panel-tab-row">
        <button
          className={`btn btn-sm ${tab === 'available' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('available')}
        >
          <AlertTriangle size={14} /> {t('volunteerPanel.tabAvailable')} ({available.length})
        </button>
        <button
          className={`btn btn-sm ${tab === 'active' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('active')}
        >
          <ClipboardCheck size={14} /> {t('volunteerPanel.tabActive')} ({active.length})
        </button>
        <button
          className={`btn btn-sm ${tab === 'history' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('history')}
        >
          <History size={14} /> {t('volunteerPanel.tabHistory')} ({history.length})
        </button>
      </div>

      {currentItems.length === 0 ? (
        <div className="empty-state">
          <Inbox size={48} strokeWidth={1.5} />
          <p>
            {tab === 'available'
              ? t('volunteerPanel.empty')
              : tab === 'active'
                ? t('volunteerPanel.emptyActive')
                : t('volunteerPanel.emptyHistory')}
          </p>
        </div>
      ) : (
        <div className="panel-list">
          {currentItems.map((task) => (
            <div key={task.id} className="list-item" style={{ cursor: 'default', flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  className="list-item-icon"
                  style={{
                    color: tab === 'available' ? 'var(--danger-500)' : 'var(--primary-500)',
                    backgroundColor: tab === 'available' ? 'var(--danger-500)15' : 'var(--primary-500)15',
                  }}
                >
                  {tab === 'available' ? <AlertTriangle size={18} /> : <ClipboardCheck size={18} />}
                </div>
                <div className="list-item-content" style={{ flex: 1 }}>
                  <h4 className="list-item-title">
                    SOS #{task.id}
                    {task.status && tab !== 'available' && (
                      <span className="mini-tag" style={{ marginLeft: '0.5rem' }}>
                        {getTaskStatusLabel(task.status, t)}
                      </span>
                    )}
                    {task.priorityLevel > 0 && (
                      <span style={{
                        marginLeft: '0.5rem',
                        fontSize: '0.7rem',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        backgroundColor: task.priorityLevel >= 3 ? 'var(--danger-500)' : 'var(--warning-500)',
                        color: 'white',
                      }}>
                        P{task.priorityLevel}
                      </span>
                    )}
                  </h4>
                  <p className="list-item-subtitle" style={{ margin: 0 }}>
                    {task.details || '—'}
                  </p>
                  {task.userName && (
                    <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                      {t('volunteerPanel.requestedBy')}: {task.userName}
                    </span>
                  )}
                </div>
                <div className="list-item-meta">
                  <span className="list-item-time">
                    <Clock size={12} /> {getShortTime(task.createdAt)}
                  </span>
                </div>
              </div>

              <div className="list-item-actions">
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => handleViewOnMap(task)}
                >
                  <MapPin size={14} /> {t('mySos.viewOnMap')}
                </button>

                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => handleGetDirections(task)}
                >
                  <Navigation size={14} /> {t('volunteerPanel.getDirections')}
                </button>

                {tab === 'available' && (
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => handleAcceptTask(task.id)}
                    disabled={acceptingId === task.id}
                  >
                    {acceptingId === task.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                    {t('volunteerPanel.acceptTask')}
                  </button>
                )}

                {tab === 'active' && (
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => {
                      setCompletingTask(task);
                      setCompletionNotes(task.completionNotes ?? '');
                    }}
                  >
                    <CheckCircle2 size={14} /> {t('volunteerPanel.completeTask')}
                  </button>
                )}
              </div>

              {tab === 'history' && task.completionNotes && (
                <div className="list-item-actions" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <strong>{t('volunteerPanel.completionNotes')}:</strong> {task.completionNotes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {completingTask && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => !completing && setCompletingTask(null)}
        >
          <div
            style={{
              background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1.5rem',
              maxWidth: '420px', width: '100%', position: 'relative',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => !completing && setCompletingTask(null)}
              style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'none', border: 'none', cursor: 'pointer' }}
              disabled={completing}
            >
              <X size={18} />
            </button>

            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>
              <CheckCircle2 size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem', color: 'var(--success-500)' }} />
              {t('volunteerPanel.completeTitle')}
            </h3>

            <p style={{ fontSize: '0.85rem', opacity: 0.75, marginBottom: '0.75rem' }}>
              SOS #{completingTask.id}
            </p>

            <textarea
              value={completionNotes}
              onChange={(event) => setCompletionNotes(event.target.value)}
              placeholder={t('volunteerPanel.completionNotesPlaceholder')}
              rows={4}
              maxLength={1000}
              style={{
                width: '100%', padding: '0.5rem', borderRadius: '8px',
                border: '1px solid var(--border-default)', background: 'var(--bg-primary)',
                resize: 'vertical', fontSize: '0.85rem', marginBottom: '0.75rem',
              }}
            />

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-sm btn-ghost" onClick={() => setCompletingTask(null)} disabled={completing}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-sm btn-success" onClick={handleCompleteTask} disabled={completing}>
                {completing ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                {t('volunteerPanel.completeTask')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getShortTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffH = Math.floor((now.getTime() - date.getTime()) / 3600000);
  if (diffH < 1) return '<1h';
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d`;
}

function getTaskStatusLabel(status: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    Pending: t('mySos.statusPending'),
    InProgress: t('mySos.statusInProgress'),
    Resolved: t('mySos.statusResolved'),
    VerifiedSafe: t('mySos.statusVerifiedSafe'),
  };
  return map[status] ?? status;
}
