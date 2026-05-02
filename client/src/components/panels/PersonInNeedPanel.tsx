import { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  HandHeart,
  MapPin,
  ShieldCheck,
  Loader2,
  Navigation,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { mapApi, personInNeedApi } from '../../services/api';
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

interface IncomingOffer {
  id: number;
  sponsorId: string;
  sponsorName: string;
  pingId?: number | null;
  pingStatus?: string | null;
  pingDetails?: string | null;
  message: string;
  status: string;
  createdAt: string;
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
  const [offers, setOffers] = useState<IncomingOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [respondingOfferId, setRespondingOfferId] = useState<number | null>(null);

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

  const fetchOffers = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await personInNeedApi.getOffers();
      setOffers(res.data as IncomingOffer[]);
    } catch {
      // Silent fail — panel still works without offer data
    }
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMyPings(), fetchOffers()]).finally(() => setLoading(false));
  }, [fetchMyPings, fetchOffers]);

  const handleConfirmSafe = async (pingId: number) => {
    try {
      setConfirmingId(pingId);
      await mapApi.confirmSafe(pingId);
      setPings((prev) =>
        prev.map((p) => (p.id === pingId ? { ...p, status: 'VerifiedSafe', isBlinking: false } : p))
      );
      toast.success(t('mySos.confirmed'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setConfirmingId(null);
    }
  };

  const handleRespondToOffer = async (offerId: number, decision: 'Accepted' | 'Declined') => {
    try {
      setRespondingOfferId(offerId);
      await personInNeedApi.respondToOffer(offerId, { decision });
      setOffers((prev) => prev.map((offer) => (
        offer.id === offerId ? { ...offer, status: decision } : offer
      )));
      toast.success(decision === 'Accepted' ? t('mySos.offerAccepted') : t('mySos.offerDeclined'));
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr.response?.data?.message || t('common.error'));
    } finally {
      setRespondingOfferId(null);
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
    <div className="panel-content person-in-need-panel">
      <div className="panel-header">
        <h2 className="panel-title">{t('mySos.title')}</h2>
        <span className="badge badge-primary">{pings.length}</span>
      </div>

      <section className="person-in-need-section">
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

                  <div className="list-item-actions" style={{ alignItems: 'center' }}>
                    <span className="list-item-time" style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                      <Clock size={11} /> {getShortTime(ping.createdAt)}
                    </span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                      <MapPin size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
                      {ping.lat.toFixed(4)}, {ping.lng.toFixed(4)}
                    </span>
                  </div>

                  <div className="list-item-actions">
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
      </section>

      <section className="person-in-need-section">
        <div className="panel-header" style={{ paddingTop: 0 }}>
          <h3 className="panel-title" style={{ fontSize: '1rem' }}>{t('mySos.helpOffers')}</h3>
          <span className="badge badge-primary">{offers.length}</span>
        </div>

        {offers.length === 0 ? (
          <div className="empty-state">
            <HandHeart size={48} strokeWidth={1.5} />
            <p>{t('mySos.noOffers')}</p>
          </div>
        ) : (
          <div className="panel-list">
            {offers.map((offer) => {
              const isPending = offer.status === 'Pending';
              const isResponding = respondingOfferId === offer.id;

              return (
                <div key={offer.id} className="list-item" style={{ cursor: 'default', flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="list-item-icon" style={{ color: 'var(--accent-500)', backgroundColor: 'var(--accent-500)15' }}>
                      <HandHeart size={18} />
                    </div>
                    <div className="list-item-content" style={{ flex: 1 }}>
                      <h4 className="list-item-title">
                        {offer.sponsorName}
                        <span className="mini-tag" style={{ marginLeft: '0.5rem' }}>
                          {getOfferStatusLabel(offer.status, t)}
                        </span>
                      </h4>
                      <p className="list-item-subtitle" style={{ margin: 0 }}>
                        {offer.pingId ? `SOS #${offer.pingId}` : t('mySos.helpOffers')}
                        {offer.pingStatus ? ` • ${getStatusLabel(offer.pingStatus)}` : ''}
                      </p>
                    </div>
                    <span className="list-item-time">
                      <Clock size={12} /> {getShortTime(offer.createdAt)}
                    </span>
                  </div>

                  {offer.pingDetails && (
                    <p className="list-item-subtitle list-item-indent" style={{ margin: 0 }}>
                      {offer.pingDetails}
                    </p>
                  )}

                  <div className="list-item-indent" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <strong>{t('sponsorPanel.offerMessageLabel')}:</strong> {offer.message}
                  </div>

                  {isPending && (
                  <div className="list-item-actions">
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleRespondToOffer(offer.id, 'Accepted')}
                        disabled={isResponding}
                      >
                        {isResponding ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        {t('mySos.acceptOffer')}
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => handleRespondToOffer(offer.id, 'Declined')}
                        disabled={isResponding}
                      >
                        <X size={14} /> {t('mySos.declineOffer')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
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

function getOfferStatusLabel(status: string, t: (key: string) => string): string {
  const labels: Record<string, string> = {
    Pending: t('mySos.statusPending'),
    Accepted: t('mySos.offerAccepted'),
    Declined: t('mySos.offerDeclined'),
  };
  return labels[status] ?? status;
}
