import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Gift,
  CheckCircle2,
  MapPin,
  Clock,
  ChevronRight,
  Pin,
  Heart,
  Home,
  Inbox,
  UtensilsCrossed,
} from 'lucide-react';
import { useMapStore, type PingData, type PingType } from '../../stores/mapStore';
import { useLanguage } from '../../contexts/LanguageContext';

const TYPE_META: Record<PingType, { icon: typeof AlertTriangle; color: string }> = {
  need_help: { icon: AlertTriangle, color: 'var(--danger-500)' },
  offering: { icon: Gift, color: 'var(--success-500)' },
  received: { icon: CheckCircle2, color: 'var(--accent-500)' },
  support_point: { icon: MapPin, color: 'var(--primary-500)' },
};

const SOS_CATEGORY_META: Record<string, { icon: typeof AlertTriangle; color: string; label: string }> = {
  evacuate: { icon: AlertTriangle, color: '#f97316', label: 'sos.tagEvacuate' },
  food: { icon: UtensilsCrossed, color: '#eab308', label: 'sos.tagFood' },
  medical: { icon: Heart, color: '#ef4444', label: 'sos.tagMedical' },
  shelter: { icon: Home, color: '#8b5cf6', label: 'sos.tagShelter' },
  other: { icon: AlertCircle, color: '#dc2626', label: 'sos.tagOther' },
};

function getPingVisual(ping: PingData) {
  if (ping.type === 'need_help') {
    const category = ping.sosCategory?.toLowerCase() || 'other';
    const categoryMeta = SOS_CATEGORY_META[category] || SOS_CATEGORY_META.other;
    return {
      icon: categoryMeta.icon,
      color: categoryMeta.color,
      categoryIcon: categoryMeta.icon,
      categoryLabel: categoryMeta.label,
    };
  }

  const typeMeta = TYPE_META[ping.type];
  return {
    icon: typeMeta.icon,
    color: typeMeta.color,
    categoryIcon: null,
    categoryLabel: null,
  };
}

type SortMode = 'time' | 'distance';

interface UserLocation {
  lat: number;
  lng: number;
}

function getDistanceKm(from: UserLocation, ping: PingData): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latDiff = toRadians(ping.lat - from.lat);
  const lngDiff = toRadians(ping.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(ping.lat);

  const a = Math.sin(latDiff / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDiff / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function comparePingPriority(a: PingData, b: PingData, sortMode: SortMode, userLocation: UserLocation | null): number {
  const attentionDiff = Number(b.requiresViewerAttention === true) - Number(a.requiresViewerAttention === true);
  if (attentionDiff !== 0) return attentionDiff;

  if (sortMode === 'distance' && userLocation) {
    const distanceDiff = getDistanceKm(userLocation, a) - getDistanceKm(userLocation, b);
    if (Math.abs(distanceDiff) > 0.01) return distanceDiff;
  }

  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export default function ListPanel() {
  const { pings, activeFilters, selectPing, setActivePanel } = useMapStore();
  const { t } = useLanguage();
  const [sortMode, setSortMode] = useState<SortMode>('time');
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'unavailable'>('idle');

  useEffect(() => {
    if (sortMode !== 'distance' || userLocation || locationStatus === 'loading' || locationStatus === 'unavailable') return;

    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      return;
    }

    setLocationStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationStatus('idle');
      },
      () => setLocationStatus('unavailable'),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 180000 }
    );
  }, [locationStatus, sortMode, userLocation]);

  const filteredPings = useMemo(
    () => pings
      .filter((p) => activeFilters.includes(p.type) && p.status === 'active')
      .sort((a, b) => comparePingPriority(a, b, sortMode, userLocation)),
    [pings, activeFilters, sortMode, userLocation]
  );
  const pinnedPings = filteredPings.filter((ping) => ping.isPinnedForViewer);
  const regularPings = filteredPings.filter((ping) => !ping.isPinnedForViewer);

  const handleSelectPing = (ping: PingData) => {
    selectPing(ping.id);
    setActivePanel(null);
  };

  const renderPingItem = (ping: PingData) => {
    const visual = getPingVisual(ping);
    const Icon = visual.icon;
    const CategoryIcon = visual.categoryIcon;
    const distanceKm = userLocation ? getDistanceKm(userLocation, ping) : null;

    return (
      <button
        key={ping.id}
        className="list-item hover-lift"
        onClick={() => handleSelectPing(ping)}
      >
        <div
          className="list-item-icon"
          style={{ color: visual.color, backgroundColor: `${visual.color}15` }}
        >
          <Icon size={18} />
        </div>
        <div className="list-item-content">
          <h4 className="list-item-title">{ping.title}</h4>
          {CategoryIcon && visual.categoryLabel && (
            <div style={{ display: 'flex', marginBottom: 'var(--sp-1-5)' }}>
              <span
                className="mini-tag"
                style={{
                  backgroundColor: `${visual.color}16`,
                  borderColor: `${visual.color}33`,
                  color: visual.color,
                  gap: 'var(--sp-1)',
                }}
              >
                <CategoryIcon size={10} />
                {t(visual.categoryLabel)}
              </span>
            </div>
          )}
          {(ping.isPinnedForViewer || ping.requiresViewerAttention) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-1-5)', marginBottom: 'var(--sp-1-5)' }}>
              {ping.isPinnedForViewer && (
                <span className="mini-tag" style={{ color: 'var(--primary-600)', backgroundColor: 'rgba(249, 115, 22, 0.12)', borderColor: 'rgba(249, 115, 22, 0.28)', gap: 'var(--sp-1)' }}>
                  <Pin size={10} />
                  Ghim
                </span>
              )}
              {ping.requiresViewerAttention && (
                <span className="mini-tag" style={{ color: 'var(--danger-600)', backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.28)', gap: 'var(--sp-1)' }}>
                  <AlertCircle size={10} />
                  Cần xem
                </span>
              )}
            </div>
          )}
          <p className="list-item-subtitle">
            <MapPin size={12} />
            {ping.address}
          </p>
          {ping.items && ping.items.length > 0 && (
            <div className="list-item-tags">
              {ping.items.slice(0, 3).map((item, i) => (
                <span key={i} className="mini-tag">{item}</span>
              ))}
              {ping.items.length > 3 && (
                <span className="mini-tag">+{ping.items.length - 3}</span>
              )}
            </div>
          )}
        </div>
        <div className="list-item-meta">
          {distanceKm !== null && (
            <span className="list-item-time">
              <MapPin size={12} />
              {formatDistance(distanceKm)}
            </span>
          )}
          <span className="list-item-time">
            <Clock size={12} />
            {getShortTime(ping.createdAt)}
          </span>
          <ChevronRight size={14} className="list-item-arrow" />
        </div>
      </button>
    );
  };

  const renderSection = (title: string, items: PingData[]) => {
    if (items.length === 0) return null;

    return (
      <section style={{ display: 'grid', gap: 'var(--sp-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--sp-1)', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 800, textTransform: 'uppercase' }}>
          <span>{title}</span>
          <span>{items.length}</span>
        </div>
        {items.map(renderPingItem)}
      </section>
    );
  };

  return (
    <div className="panel-content">
      <div className="panel-header">
        <h2 className="panel-title">{t('panel.requestList')}</h2>
        <span className="badge badge-primary">{filteredPings.length}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
        <button
          type="button"
          className={`btn btn-sm ${sortMode === 'time' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setSortMode('time')}
        >
          <Clock size={13} />
          Mới nhất
        </button>
        <button
          type="button"
          className={`btn btn-sm ${sortMode === 'distance' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => {
            if (!userLocation) setLocationStatus('idle');
            setSortMode('distance');
          }}
        >
          <MapPin size={13} />
          Gần tôi
        </button>
        {locationStatus === 'loading' && (
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>Đang lấy GPS...</span>
        )}
        {sortMode === 'distance' && locationStatus === 'unavailable' && (
          <span style={{ color: 'var(--danger-500)', fontSize: 'var(--text-xs)' }}>Không lấy được GPS</span>
        )}
      </div>

      {filteredPings.length === 0 ? (
        <div className="empty-state">
          <Inbox size={48} strokeWidth={1.5} />
          <p>{t('panel.noResults')}</p>
        </div>
      ) : (
        <div className="panel-list" style={{ gap: 'var(--sp-4)' }}>
          {renderSection('Đã ghim', pinnedPings)}
          {renderSection(pinnedPings.length > 0 ? 'Ping khác' : 'Tất cả ping', regularPings)}
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

function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)}m`;
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)}km`;
}
