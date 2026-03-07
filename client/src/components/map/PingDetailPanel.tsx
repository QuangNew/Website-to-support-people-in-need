import { useMemo } from 'react';
import {
  X,
  AlertTriangle,
  Gift,
  CheckCircle2,
  MapPin,
  Clock,
  Phone,
  Package,
  Navigation,
  Loader2,
} from 'lucide-react';
import { useMapStore, type PingType } from '../../stores/mapStore';
import { useLanguage } from '../../contexts/LanguageContext';

const TYPE_CONFIG: Record<PingType, { label: string; icon: typeof AlertTriangle; colorClass: string }> = {
  need_help: { label: 'filter.needHelp', icon: AlertTriangle, colorClass: 'text-danger' },
  offering: { label: 'filter.offering', icon: Gift, colorClass: 'text-success' },
  received: { label: 'filter.received', icon: CheckCircle2, colorClass: 'text-accent' },
  support_point: { label: 'filter.supportPoint', icon: MapPin, colorClass: 'text-primary' },
};

export default function PingDetailPanel() {
  const { selectedPingId, pings, selectPing, fetchRoute, clearRoute, route, isRouting, routeError } = useMapStore();
  const { t } = useLanguage();

  const ping = useMemo(
    () => pings.find((p) => p.id === selectedPingId),
    [pings, selectedPingId]
  );

  if (!ping) return null;

  const config = TYPE_CONFIG[ping.type];
  const Icon = config.icon;
  const timeAgo = getRelativeTime(ping.createdAt, t);

  const handleDirections = () => {
    if (isRouting) return;
    fetchRoute(ping.lat, ping.lng);
  };

  const handleClose = () => {
    selectPing(null);
    clearRoute();
  };

  return (
    <div className="ping-detail-panel animate-slide-in-up">
      {/* Header */}
      <div className="ping-detail-header">
        <div className="ping-detail-type">
          <span className={`ping-type-badge ${config.colorClass}`}>
            <Icon size={14} />
            {t(config.label)}
          </span>
          <span className={`ping-status-badge ping-status-${ping.status}`}>
            {t(`ping.status.${ping.status}`)}
          </span>
        </div>
        <button className="btn-ghost btn-sm" onClick={handleClose} aria-label={t('common.close')}>
          <X size={16} />
        </button>
      </div>

      {/* Title */}
      <h3 className="ping-detail-title">{ping.title}</h3>

      {/* Description */}
      <p className="ping-detail-description">{ping.description}</p>

      {/* Info rows */}
      <div className="ping-detail-info">
        <div className="ping-info-row">
          <MapPin size={14} />
          <span>{ping.address}</span>
        </div>
        <div className="ping-info-row">
          <Clock size={14} />
          <span>{timeAgo}</span>
        </div>
        {ping.contactPhone && (
          <div className="ping-info-row">
            <Phone size={14} />
            <a href={`tel:${ping.contactPhone}`} className="ping-phone-link">
              {ping.contactPhone}
            </a>
          </div>
        )}
      </div>

      {/* Items */}
      {ping.items && ping.items.length > 0 && (
        <div className="ping-detail-items">
          <div className="ping-items-header">
            <Package size={14} />
            <span>{t('ping.items')}</span>
          </div>
          <div className="ping-items-list">
            {ping.items.map((item, i) => (
              <span key={i} className="mini-tag">{item}</span>
            ))}
          </div>
        </div>
      )}

      {/* Route info */}
      {route && route.destination.lat === ping.lat && route.destination.lng === ping.lng && (
        <div className="ping-route-info">
          <div className="ping-route-info-row">
            <span className="ping-route-label">{t('ping.distance')}</span>
            <span className="ping-route-value">{route.info.distanceKm} km</span>
          </div>
          <div className="ping-route-info-row">
            <span className="ping-route-label">{t('ping.duration')}</span>
            <span className="ping-route-value">
              {route.info.durationMin < 60
                ? `${route.info.durationMin} ${t('ping.minutes')}`
                : `${Math.floor(route.info.durationMin / 60)}h ${route.info.durationMin % 60}m`}
            </span>
          </div>
          {route.alternativeInfo && (
            <div className="ping-route-alt">
              {t('ping.altRoute')}: {route.alternativeInfo.distanceKm} km, {route.alternativeInfo.durationMin} {t('ping.minutes')}
            </div>
          )}
          <button className="btn btn-ghost btn-sm ping-route-clear" onClick={clearRoute}>
            <X size={12} />
            {t('ping.clearRoute')}
          </button>
        </div>
      )}

      {/* Route error */}
      {routeError && (
        <div className="ping-route-error">
          {routeError}
        </div>
      )}

      {/* Actions */}
      <div className="ping-detail-actions">
        <button
          className="btn btn-primary btn-sm"
          onClick={handleDirections}
          disabled={isRouting}
        >
          {isRouting ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
          {isRouting ? t('common.loading') : t('ping.directions')}
        </button>
        {ping.type === 'need_help' && ping.status === 'active' && (
          <button className="btn btn-accent btn-sm">
            <Gift size={14} />
            {t('ping.support')}
          </button>
        )}
      </div>
    </div>
  );
}

function getRelativeTime(dateStr: string, t: (key: string) => string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return t('ping.time.justNow');
  if (diffMins < 60) return `${diffMins} ${t('ping.time.minutesAgo')}`;
  if (diffHours < 24) return `${diffHours} ${t('ping.time.hoursAgo')}`;
  if (diffDays < 30) return `${diffDays} ${t('ping.time.daysAgo')}`;
  return date.toLocaleDateString('vi-VN');
}
