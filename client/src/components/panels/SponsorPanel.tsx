import { useEffect, useState, useCallback } from 'react';
import {
  Heart,
  Clock,
  Inbox,
  MapPin,
  Loader2,
  Send,
  MessageSquare,
  AlertTriangle,
  X,
} from 'lucide-react';
import { sponsorApi } from '../../services/api';
import { useMapStore } from '../../stores/mapStore';
import { useLanguage } from '../../contexts/LanguageContext';

interface SOSCase {
  id: number;
  coordinatesLat: number;
  coordinatesLong: number;
  status: string;
  details: string | null;
  createdAt: string;
  userName: string | null;
}

interface SocialCase {
  id: number;
  content: string;
  category: string;
  createdAt: string;
  authorName: string | null;
}

type TabType = 'sos' | 'posts';

export default function SponsorPanel() {
  const { selectPing, setActivePanel, setFlyTo } = useMapStore();
  const { t } = useLanguage();

  const [tab, setTab] = useState<TabType>('sos');
  const [sosCases, setSOSCases] = useState<SOSCase[]>([]);
  const [socialCases, setSocialCases] = useState<SocialCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');

  // Offer help modal state
  const [offerTarget, setOfferTarget] = useState<SOSCase | null>(null);
  const [offerMessage, setOfferMessage] = useState('');
  const [offering, setOffering] = useState(false);
  const [offerSent, setOfferSent] = useState(false);

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (category) params.category = category;
      if (status) params.status = status;

      const res = await sponsorApi.searchCases(params);
      const data = res.data as { sosCases: SOSCase[]; socialCases: SocialCase[] };
      setSOSCases(data.sosCases ?? []);
      setSocialCases(data.socialCases ?? []);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [category, status]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const handleOfferHelp = async () => {
    if (!offerTarget) return;
    try {
      setOffering(true);
      await sponsorApi.offerHelp({ pingId: offerTarget.id, message: offerMessage || undefined });
      setOfferSent(true);
      setTimeout(() => {
        setOfferTarget(null);
        setOfferMessage('');
        setOfferSent(false);
      }, 1500);
    } catch {
      // Silent fail
    } finally {
      setOffering(false);
    }
  };

  const handleViewOnMap = (c: SOSCase) => {
    setFlyTo({ lat: c.coordinatesLat, lng: c.coordinatesLong, zoom: 15 });
    selectPing(String(c.id));
    setActivePanel(null);
  };

  const categories = ['Livelihood', 'Medical', 'Education'];
  const statuses = ['Pending', 'InProgress', 'Resolved'];

  return (
    <div className="panel-content">
      <div className="panel-header">
        <h2 className="panel-title">{t('sponsorPanel.title')}</h2>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', padding: '0 1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <select
          className="select-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ flex: 1, minWidth: '120px', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.8rem' }}
        >
          <option value="">{t('sponsorPanel.allCategories')}</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          className="select-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ flex: 1, minWidth: '120px', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.8rem' }}
        >
          <option value="">{t('sponsorPanel.allStatuses')}</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', padding: '0 1rem', marginBottom: '0.75rem' }}>
        <button
          className={`btn btn-sm ${tab === 'sos' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('sos')}
        >
          <AlertTriangle size={14} /> {t('sponsorPanel.tabSOS')} ({sosCases.length})
        </button>
        <button
          className={`btn btn-sm ${tab === 'posts' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('posts')}
        >
          <MessageSquare size={14} /> {t('sponsorPanel.tabPosts')} ({socialCases.length})
        </button>
      </div>

      {loading ? (
        <div className="empty-state">
          <Loader2 size={32} className="animate-spin" />
        </div>
      ) : tab === 'sos' ? (
        sosCases.length === 0 ? (
          <div className="empty-state">
            <Inbox size={48} strokeWidth={1.5} />
            <p>{t('sponsorPanel.empty')}</p>
          </div>
        ) : (
          <div className="panel-list">
            {sosCases.map((c) => (
              <div key={c.id} className="list-item" style={{ cursor: 'default', flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    className="list-item-icon"
                    style={{ color: 'var(--danger-500)', backgroundColor: 'var(--danger-500)15' }}
                  >
                    <AlertTriangle size={18} />
                  </div>
                  <div className="list-item-content" style={{ flex: 1 }}>
                    <h4 className="list-item-title">
                      SOS #{c.id}
                      <span className="mini-tag" style={{ marginLeft: '0.5rem' }}>{c.status}</span>
                    </h4>
                    <p className="list-item-subtitle" style={{ margin: 0 }}>
                      {c.details || '—'}
                    </p>
                    {c.userName && (
                      <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                        {c.userName}
                      </span>
                    )}
                  </div>
                  <span className="list-item-time">
                    <Clock size={12} /> {getShortTime(c.createdAt)}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', paddingLeft: '2.75rem' }}>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => handleViewOnMap(c)}
                  >
                    <MapPin size={14} /> {t('mySos.viewOnMap')}
                  </button>
                  <button
                    className="btn btn-sm btn-warning"
                    onClick={() => setOfferTarget(c)}
                  >
                    <Heart size={14} /> {t('sponsorPanel.offerHelp')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        socialCases.length === 0 ? (
          <div className="empty-state">
            <Inbox size={48} strokeWidth={1.5} />
            <p>{t('sponsorPanel.empty')}</p>
          </div>
        ) : (
          <div className="panel-list">
            {socialCases.map((p) => (
              <div key={p.id} className="list-item" style={{ cursor: 'default', flexDirection: 'column', alignItems: 'stretch', gap: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    className="list-item-icon"
                    style={{ color: 'var(--primary-500)', backgroundColor: 'var(--primary-500)15' }}
                  >
                    <MessageSquare size={18} />
                  </div>
                  <div className="list-item-content" style={{ flex: 1 }}>
                    <h4 className="list-item-title">
                      {p.authorName ?? 'Anonymous'}
                      <span className="mini-tag" style={{ marginLeft: '0.5rem' }}>{p.category}</span>
                    </h4>
                    <p className="list-item-subtitle" style={{ margin: 0 }}>
                      {p.content.length > 120 ? p.content.slice(0, 120) + '…' : p.content}
                    </p>
                  </div>
                  <span className="list-item-time">
                    <Clock size={12} /> {getShortTime(p.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Offer Help Modal */}
      {offerTarget && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
        }}
          onClick={() => { setOfferTarget(null); setOfferMessage(''); }}
        >
          <div
            style={{
              background: 'var(--surface)', borderRadius: '12px', padding: '1.5rem',
              maxWidth: '400px', width: '100%', position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setOfferTarget(null); setOfferMessage(''); }}
              style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>

            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>
              <Heart size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem', color: 'var(--warning-500)' }} />
              {t('sponsorPanel.offerHelp')}
            </h3>

            <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.75rem' }}>
              SOS #{offerTarget.id} — {offerTarget.userName ?? 'Unknown'}
            </p>

            <textarea
              value={offerMessage}
              onChange={(e) => setOfferMessage(e.target.value)}
              placeholder={t('sponsorPanel.offerMessage')}
              maxLength={1000}
              rows={3}
              style={{
                width: '100%', padding: '0.5rem', borderRadius: '8px',
                border: '1px solid var(--border)', background: 'var(--background)',
                resize: 'vertical', fontSize: '0.85rem', marginBottom: '0.75rem',
              }}
            />

            {offerSent ? (
              <div style={{ textAlign: 'center', color: 'var(--success-500)', fontWeight: 600 }}>
                ✓ {t('sponsorPanel.offerSent')}
              </div>
            ) : (
              <button
                className="btn btn-warning"
                onClick={handleOfferHelp}
                disabled={offering}
                style={{ width: '100%' }}
              >
                {offering ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                {t('sponsorPanel.offerHelp')}
              </button>
            )}
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
