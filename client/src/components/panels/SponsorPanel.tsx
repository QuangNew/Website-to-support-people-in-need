import { useEffect, useState, useCallback } from 'react';
import {
  Heart,
  BarChart3,
  Clock,
  Inbox,
  MapPin,
  Loader2,
  Send,
  MessageSquare,
  AlertTriangle,
  X,
  Package,
  Plus,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { sponsorApi, supplyApi } from '../../services/api';
import { useMapStore } from '../../stores/mapStore';
import { useLanguage } from '../../contexts/LanguageContext';
import { isInsideVietnam } from '../../utils/vietnamTerritory';

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

interface SponsorOffer {
  id: number;
  targetUserId: string;
  targetUserName: string;
  pingId?: number | null;
  pingStatus?: string | null;
  pingDetails?: string | null;
  message: string;
  status: string;
  createdAt: string;
}

interface SponsorImpact {
  totalOffers: number;
  pendingOffers: number;
  acceptedOffers: number;
  declinedOffers: number;
  supportedPeople: number;
}

type TabType = 'sos' | 'posts' | 'offers' | 'supply';

interface SupplyItem {
  id: number;
  name: string;
  quantity: number;
  lat: number;
  lng: number;
  createdAt: string;
}

interface SupplyForm {
  name: string;
  quantity: number;
  lat: number;
  lng: number;
}

const emptySupplyForm: SupplyForm = { name: '', quantity: 0, lat: 0, lng: 0 };

const emptyImpact: SponsorImpact = {
  totalOffers: 0,
  pendingOffers: 0,
  acceptedOffers: 0,
  declinedOffers: 0,
  supportedPeople: 0,
};

export default function SponsorPanel() {
  const { selectPing, setActivePanel, setFlyTo } = useMapStore();
  const { t } = useLanguage();

  const [tab, setTab] = useState<TabType>('sos');
  const [sosCases, setSOSCases] = useState<SOSCase[]>([]);
  const [socialCases, setSocialCases] = useState<SocialCase[]>([]);
  const [offers, setOffers] = useState<SponsorOffer[]>([]);
  const [impact, setImpact] = useState<SponsorImpact>(emptyImpact);
  const [loading, setLoading] = useState(true);
  const [offersLoading, setOffersLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');

  // Offer help modal state
  const [offerTarget, setOfferTarget] = useState<SOSCase | null>(null);
  const [offerMessage, setOfferMessage] = useState('');
  const [offering, setOffering] = useState(false);
  const [offerSent, setOfferSent] = useState(false);

  // Supply state
  const [supplies, setSupplies] = useState<SupplyItem[]>([]);
  const [supplyLoading, setSupplyLoading] = useState(false);
  const [showSupplyForm, setShowSupplyForm] = useState(false);
  const [supplyForm, setSupplyForm] = useState<SupplyForm>(emptySupplyForm);
  const [supplyFormError, setSupplyFormError] = useState('');
  const [savingSupply, setSavingSupply] = useState(false);

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

  const fetchOfferData = useCallback(async () => {
    setOffersLoading(true);
    try {
      const [offersRes, impactRes] = await Promise.all([
        sponsorApi.getOffers(),
        sponsorApi.getImpact(),
      ]);
      setOffers((offersRes.data as SponsorOffer[]) ?? []);
      setImpact((impactRes.data as SponsorImpact) ?? emptyImpact);
    } catch {
      // Silent fail
    } finally {
      setOffersLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOfferData();
  }, [fetchOfferData]);

  const handleOfferHelp = async () => {
    if (!offerTarget) return;
    try {
      setOffering(true);
      await sponsorApi.offerHelp({ pingId: offerTarget.id, message: offerMessage || undefined });
      toast.success(t('sponsorPanel.offerSent'));
      void fetchOfferData();
      setOfferSent(true);
      setTimeout(() => {
        setOfferTarget(null);
        setOfferMessage('');
        setOfferSent(false);
      }, 1500);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr.response?.data?.message || t('common.error'));
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

  // ── Supply CRUD ──
  const fetchSupplies = useCallback(async () => {
    setSupplyLoading(true);
    try {
      const res = await supplyApi.getSupplies();
      setSupplies(res.data as SupplyItem[]);
    } catch {
      toast.error(t('sponsorPanel.supplyLoadError'));
    } finally {
      setSupplyLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (tab === 'supply') fetchSupplies();
  }, [tab, fetchSupplies]);

  const openCreateSupply = () => {
    setSupplyForm(emptySupplyForm);
    setSupplyFormError('');
    setShowSupplyForm(true);
  };

  const closeSupplyForm = () => {
    setSupplyForm(emptySupplyForm);
    setSupplyFormError('');
    setShowSupplyForm(false);
  };

  const handleSaveSupply = async () => {
    const trimmedName = supplyForm.name.trim();

    if (!trimmedName) {
      setSupplyFormError(t('sponsorPanel.supplyNameRequired'));
      return;
    }

    if (!Number.isInteger(supplyForm.quantity) || supplyForm.quantity < 0) {
      setSupplyFormError(t('sponsorPanel.supplyQuantityInvalid'));
      return;
    }

    if (!Number.isFinite(supplyForm.lat) || !Number.isFinite(supplyForm.lng)) {
      setSupplyFormError(t('sponsorPanel.supplyLocationRequired'));
      return;
    }

    if (!isInsideVietnam(supplyForm.lat, supplyForm.lng)) {
      setSupplyFormError(t('sponsorPanel.supplyLocationInvalid'));
      return;
    }

    setSavingSupply(true);
    setSupplyFormError('');
    try {
      await supplyApi.createSupply({
        name: trimmedName,
        quantity: supplyForm.quantity,
        lat: supplyForm.lat,
        lng: supplyForm.lng,
      });
      closeSupplyForm();
      toast.success(t('sponsorPanel.supplyCreated'));
      void fetchSupplies();
    } catch {
      const message = t('common.error');
      setSupplyFormError(message);
      toast.error(message);
    } finally {
      setSavingSupply(false);
    }
  };

  const handleViewSupplyOnMap = (s: SupplyItem) => {
    setFlyTo({ lat: s.lat, lng: s.lng, zoom: 15 });
    setActivePanel(null);
  };

  const impactCards = [
    { key: 'totalOffers', icon: Heart, value: impact.totalOffers, label: t('sponsorPanel.metricTotalOffers'), color: 'var(--warning-500)' },
    { key: 'pendingOffers', icon: Clock, value: impact.pendingOffers, label: t('sponsorPanel.metricPendingOffers'), color: 'var(--primary-500)' },
    { key: 'acceptedOffers', icon: BarChart3, value: impact.acceptedOffers, label: t('sponsorPanel.metricAcceptedOffers'), color: 'var(--success-500)' },
    { key: 'supportedPeople', icon: Users, value: impact.supportedPeople, label: t('sponsorPanel.metricSupportedPeople'), color: 'var(--accent-500)' },
  ];

  return (
    <div className="panel-content">
      <div className="panel-header">
        <h2 className="panel-title">{t('sponsorPanel.title')}</h2>
      </div>

      <div style={{ padding: '0 1rem', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
          <BarChart3 size={14} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t('sponsorPanel.impactTitle')}</span>
        </div>
        <div className="panel-stat-grid">
          {impactCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.key}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '0.75rem',
                  background: 'var(--surface)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{card.label}</span>
                  <Icon size={14} style={{ color: card.color }} />
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{card.value}</div>
              </div>
            );
          })}
        </div>
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
      <div className="panel-tab-row">
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
        <button
          className={`btn btn-sm ${tab === 'offers' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('offers')}
        >
          <Heart size={14} /> {t('sponsorPanel.tabOffers')} ({offers.length})
        </button>
        <button
          className={`btn btn-sm ${tab === 'supply' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('supply')}
        >
          <Package size={14} /> {t('sponsorPanel.tabSupply')}
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
                  {(c.status === 'Pending' || c.status === 'InProgress') && (
                    <button
                      className="btn btn-sm btn-warning"
                      onClick={() => setOfferTarget(c)}
                    >
                      <Heart size={14} /> {t('sponsorPanel.offerHelp')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === 'posts' ? (
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
      ) : tab === 'offers' ? (
        offersLoading ? (
          <div className="empty-state">
            <Loader2 size={32} className="animate-spin" />
          </div>
        ) : offers.length === 0 ? (
          <div className="empty-state">
            <Heart size={48} strokeWidth={1.5} />
            <p>{t('sponsorPanel.noOfferHistory')}</p>
          </div>
        ) : (
          <div className="panel-list">
            {offers.map((offer) => (
              <div key={offer.id} className="list-item" style={{ cursor: 'default', flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="list-item-icon" style={{ color: 'var(--warning-500)', backgroundColor: 'var(--warning-500)15' }}>
                    <Heart size={18} />
                  </div>
                  <div className="list-item-content" style={{ flex: 1 }}>
                    <h4 className="list-item-title">
                      {offer.targetUserName}
                      <span className="mini-tag" style={{ marginLeft: '0.5rem' }}>{getOfferStatusLabel(offer.status, t)}</span>
                    </h4>
                    <p className="list-item-subtitle" style={{ margin: 0 }}>
                      {offer.pingId ? `SOS #${offer.pingId}` : t('sponsorPanel.generalOffer')}
                      {offer.pingStatus ? ` • ${getCaseStatusLabel(offer.pingStatus, t)}` : ''}
                    </p>
                  </div>
                  <span className="list-item-time">
                    <Clock size={12} /> {getShortTime(offer.createdAt)}
                  </span>
                </div>

                {offer.pingDetails && (
                  <p className="list-item-subtitle" style={{ margin: 0, paddingLeft: '2.75rem' }}>
                    {offer.pingDetails}
                  </p>
                )}

                <div style={{ paddingLeft: '2.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <strong>{t('sponsorPanel.offerMessageLabel')}:</strong> {offer.message}
                </div>
              </div>
            ))}
          </div>
        )
      ) : /* tab === 'supply' */ (
        <div style={{ padding: '0 1rem' }}>
          {/* Create button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
            <button className="btn btn-sm btn-primary" onClick={openCreateSupply}>
              <Plus size={14} /> {t('sponsorPanel.newSupply')}
            </button>
          </div>

          {/* Supply form */}
          {showSupplyForm && (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px',
              padding: '1rem', marginBottom: '0.75rem',
            }}>
              <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>
                {t('sponsorPanel.newSupply')}
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder={t('sponsorPanel.supplyName')}
                  value={supplyForm.name}
                  onChange={(e) => setSupplyForm((f) => ({ ...f, name: e.target.value }))}
                  style={{
                    width: '100%', padding: '0.4rem 0.6rem', borderRadius: '6px',
                    border: '1px solid var(--border)', background: 'var(--background)', fontSize: '0.85rem',
                  }}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {t('sponsorPanel.quantity')}
                    </label>
                    <input
                      type="number"
                      value={supplyForm.quantity}
                      onChange={(e) => setSupplyForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                      min={0}
                      step={1}
                      style={{
                        width: '100%', padding: '0.4rem 0.6rem', borderRadius: '6px',
                        border: '1px solid var(--border)', background: 'var(--background)', fontSize: '0.85rem',
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {t('sponsorPanel.latitude')}
                    </label>
                    <input
                      type="number"
                      value={supplyForm.lat}
                      onChange={(e) => setSupplyForm((f) => ({ ...f, lat: Number(e.target.value) }))}
                      step={0.0001}
                      style={{
                        width: '100%', padding: '0.4rem 0.6rem', borderRadius: '6px',
                        border: '1px solid var(--border)', background: 'var(--background)', fontSize: '0.85rem',
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {t('sponsorPanel.longitude')}
                    </label>
                    <input
                      type="number"
                      value={supplyForm.lng}
                      onChange={(e) => setSupplyForm((f) => ({ ...f, lng: Number(e.target.value) }))}
                      step={0.0001}
                      style={{
                        width: '100%', padding: '0.4rem 0.6rem', borderRadius: '6px',
                        border: '1px solid var(--border)', background: 'var(--background)', fontSize: '0.85rem',
                      }}
                    />
                  </div>
                </div>

                {supplyFormError && (
                  <p style={{ color: 'var(--danger-500)', fontSize: '0.8rem', margin: 0 }}>{supplyFormError}</p>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={closeSupplyForm}
                    disabled={savingSupply}
                  >
                    {t('common.cancel')}
                  </button>
                  <button className="btn btn-sm btn-primary" onClick={handleSaveSupply} disabled={savingSupply}>
                    {savingSupply && <Loader2 size={14} className="animate-spin" />}
                    {savingSupply
                      ? t('common.saving')
                      : t('common.create')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Supply list */}
          {supplyLoading ? (
            <div className="empty-state">
              <Loader2 size={32} className="animate-spin" />
            </div>
          ) : supplies.length === 0 ? (
            <div className="empty-state">
              <Package size={48} strokeWidth={1.5} />
              <p>{t('sponsorPanel.noSupplies')}</p>
            </div>
          ) : (
            <div className="panel-list">
              {supplies.map((s) => (
                <div key={s.id} className="list-item" style={{ cursor: 'default', flexDirection: 'column', alignItems: 'stretch', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      className="list-item-icon"
                      style={{ color: s.quantity > 0 ? 'var(--primary-500)' : 'var(--text-muted)', backgroundColor: s.quantity > 0 ? 'var(--primary-500)15' : 'var(--text-muted)15' }}
                    >
                      <Package size={18} />
                    </div>
                    <div className="list-item-content" style={{ flex: 1 }}>
                      <h4 className="list-item-title">
                        {s.name}
                        <span className="mini-tag" style={{ marginLeft: '0.5rem' }}>×{s.quantity}</span>
                      </h4>
                      <p className="list-item-subtitle" style={{ margin: 0 }}>
                        {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                      </p>
                    </div>
                    <span className="list-item-time">
                      <Clock size={12} /> {getShortTime(s.createdAt)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', paddingLeft: '2.75rem' }}>
                    <button className="btn btn-sm btn-ghost" onClick={() => handleViewSupplyOnMap(s)}>
                      <MapPin size={14} /> {t('mySos.viewOnMap')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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

function getCaseStatusLabel(status: string, t: (key: string) => string): string {
  const labels: Record<string, string> = {
    Pending: t('mySos.statusPending'),
    InProgress: t('mySos.statusInProgress'),
    Resolved: t('mySos.statusResolved'),
    VerifiedSafe: t('mySos.statusVerifiedSafe'),
  };
  return labels[status] ?? status;
}

function getOfferStatusLabel(status: string, t: (key: string) => string): string {
  const labels: Record<string, string> = {
    Pending: t('mySos.statusPending'),
    Accepted: t('sponsorPanel.offerAccepted'),
    Declined: t('sponsorPanel.offerDeclined'),
  };
  return labels[status] ?? status;
}
