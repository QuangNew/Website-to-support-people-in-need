import { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  MapPin,
  ShieldCheck,
  Loader2,
  Navigation,
} from 'lucide-react';
import { mapApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useMapStore } from '../../stores/mapStore';
import { useLanguage } from '../../contexts/LanguageContext';

interface UserPing {
  id: number;
  lat: number;
  lng: number;
  type: string;
  status: string;
  priorityLevel: number;
  details: string | null;
  createdAt: string;
  userName: string | null;
  isBlinking: boolean;
}

const STATUS_CONFIG: Record<string, { color: string; icon: typeof AlertTriangle }> = {
  Pending: { color: 'var(--warning-500)', icon: Clock },
  InProgress: { color: 'var(--primary-500)', icon: Loader2 },
  Resolved: { color: 'var(--success-500)', icon: CheckCircle2 },
  VerifiedSafe: { color: 'var(--success-600)', icon: ShieldCheck },
};

export default function PersonInNeedPanel() {
  const { user } = useAuthStore();
  const { selectPing, setActivePanel, setFlyTo } = useMapStore();
  const { t } = useLanguage();

  const [pings, setPings] = useState<UserPing[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const fetchMyPings = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const res = await mapApi.getPingsByUser(user.id);
      setPings(res.data as UserPing[]);
    } catch {
      // Silent fail — user sees empty state
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchMyPings();
  }, [fetchMyPings]);

  const handleConfirmSafe = async (pingId: number) => {
    try {
      setConfirmingId(pingId);
      await mapApi.confirmSafe(pingId);
      setPings((prev) =>
        prev.map((p) => (p.id === pingId ? { ...p, status: 'VerifiedSafe', isBlinking: false } : p))
      );
    } catch {
      // Silent fail
    } finally {
      setConfirmingId(null);
    }
  };

  const handleViewOnMap = (ping: UserPing) => {
    setFlyTo({ lat: ping.lat, lng: ping.lng, zoom: 15 });
    selectPing(String(ping.id));
    setActivePanel(null);
  };

  const getStatusLabel = (status: string): string => {
    const map: Record<string, string> = {
      Pending: t('mySos.statusPending'),
      InProgress: t('mySos.statusInProgress'),
      Resolved: t('mySos.statusResolved'),
      VerifiedSafe: t('mySos.statusVerifiedSafe'),
    };
    return map[status] ?? status;
  };

  if (loading) {
    return (
      <div className="panel-content">
        <div className="panel-header">
          <h2 className="panel-title">{t('mySos.title')}</h2>
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
        <h2 className="panel-title">{t('mySos.title')}</h2>
        <span className="badge badge-primary">{pings.length}</span>
      </div>

      {pings.length === 0 ? (
        <div className="empty-state">
          <Inbox size={48} strokeWidth={1.5} />
          <p>{t('mySos.empty')}</p>
          <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>{t('mySos.emptyHint')}</p>
        </div>
      ) : (
        <div className="panel-list">
          {pings.map((ping) => {
            const cfg = STATUS_CONFIG[ping.status] ?? STATUS_CONFIG.Pending;
            const StatusIcon = cfg.icon;
            const canConfirmSafe = ping.status === 'Pending' || ping.status === 'InProgress';

            return (
              <div key={ping.id} className="list-item" style={{ cursor: 'default', flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    className="list-item-icon"
                    style={{ color: cfg.color, backgroundColor: `${cfg.color}15` }}
                  >
                    <StatusIcon size={18} />
                  </div>
                  <div className="list-item-content" style={{ flex: 1 }}>
                    <h4 className="list-item-title">
                      SOS #{ping.id}
                      {ping.isBlinking && (
                        <span style={{ color: 'var(--danger-500)', marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                          ● {t('mySos.statusPending')}
                        </span>
                      )}
                    </h4>
                    <p className="list-item-subtitle" style={{ margin: 0 }}>
                      {ping.details || '—'}
                    </p>
                  </div>
                  <div className="list-item-meta">
                    <span
                      className="mini-tag"
                      style={{ backgroundColor: `${cfg.color}20`, color: cfg.color, fontWeight: 600 }}
                    >
                      {getStatusLabel(ping.status)}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '2.75rem' }}>
                  <span className="list-item-time" style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                    <Clock size={11} /> {getShortTime(ping.createdAt)}
                  </span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                    <MapPin size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
                    {ping.lat.toFixed(4)}, {ping.lng.toFixed(4)}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', paddingLeft: '2.75rem' }}>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => handleViewOnMap(ping)}
                  >
                    <Navigation size={14} /> {t('mySos.viewOnMap')}
                  </button>

                  {canConfirmSafe && (
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => handleConfirmSafe(ping.id)}
                      disabled={confirmingId === ping.id}
                    >
                      {confirmingId === ping.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <ShieldCheck size={14} />
                      )}
                      {t('mySos.confirmSafe')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
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
