import { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  MapPin,
  Loader2,
  Navigation,
  ClipboardCheck,
} from 'lucide-react';
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
}

type TabType = 'available' | 'active';

export default function VolunteerPanel() {
  const { selectPing, setActivePanel, setFlyTo, fetchRoute } = useMapStore();
  const { t } = useLanguage();

  const [tab, setTab] = useState<TabType>('available');
  const [available, setAvailable] = useState<TaskItem[]>([]);
  const [active, setActive] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);

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

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchAvailable(), fetchActive()]).finally(() => setLoading(false));
  }, [fetchAvailable, fetchActive]);

  const handleAcceptTask = async (pingId: number) => {
    try {
      setAcceptingId(pingId);
      await volunteerApi.acceptTask({ pingId });
      // Move from available to active
      const accepted = available.find((t) => t.id === pingId);
      if (accepted) {
        setAvailable((prev) => prev.filter((t) => t.id !== pingId));
        setActive((prev) => [{ ...accepted, status: 'InProgress' }, ...prev]);
      }
    } catch {
      // Silent fail
    } finally {
      setAcceptingId(null);
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

  const currentItems = tab === 'available' ? available : active;

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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', padding: '0 1rem', marginBottom: '0.75rem' }}>
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
      </div>

      {currentItems.length === 0 ? (
        <div className="empty-state">
          <Inbox size={48} strokeWidth={1.5} />
          <p>{tab === 'available' ? t('volunteerPanel.empty') : t('volunteerPanel.emptyActive')}</p>
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

              <div style={{ display: 'flex', gap: '0.5rem', paddingLeft: '2.75rem' }}>
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
              </div>
            </div>
          ))}
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
