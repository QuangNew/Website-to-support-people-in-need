import { useEffect, useMemo, useState } from 'react';
import {
  X,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Gift,
  CheckCircle2,
  Heart,
  Home,
  MapPin,
  Clock,
  Phone,
  Navigation,
  Loader2,
  Trash2,
  UtensilsCrossed,
  Mail,
} from 'lucide-react';
import { useMapStore, type PingType } from '../../stores/mapStore';
import { mapBackendPing } from '../../stores/mapStore';
import { useAuthStore } from '../../stores/authStore';
import { useLanguage } from '../../contexts/LanguageContext';
import { getImageUrl, mapApi } from '../../services/api';
import UserPreviewModal from '../ui/UserPreviewModal';
import toast from 'react-hot-toast';

const TYPE_CONFIG: Record<PingType, { label: string; icon: typeof AlertTriangle; colorClass: string }> = {
  need_help: { label: 'filter.needHelp', icon: AlertTriangle, colorClass: 'text-danger' },
  offering: { label: 'filter.offering', icon: Gift, colorClass: 'text-success' },
  received: { label: 'filter.received', icon: CheckCircle2, colorClass: 'text-accent' },
  support_point: { label: 'filter.supportPoint', icon: MapPin, colorClass: 'text-primary' },
};

const SOS_CATEGORY_CONFIG: Record<string, { label: string; icon: typeof AlertTriangle; color: string }> = {
  evacuate: { label: 'sos.tagEvacuate', icon: AlertTriangle, color: '#f97316' },
  food: { label: 'sos.tagFood', icon: UtensilsCrossed, color: '#eab308' },
  medical: { label: 'sos.tagMedical', icon: Heart, color: '#ef4444' },
  shelter: { label: 'sos.tagShelter', icon: Home, color: '#8b5cf6' },
  other: { label: 'sos.tagOther', icon: AlertCircle, color: '#dc2626' },
};

function getSosCategoryConfig(sosCategory?: string) {
  if (!sosCategory) return null;
  return SOS_CATEGORY_CONFIG[sosCategory.toLowerCase()] || SOS_CATEGORY_CONFIG.other;
}

export default function PingDetailPanel() {
  const { selectedPingId, pings, selectPing, fetchRoute, clearRoute, selectRouteIndex, route, isRouting, routeError, removePing, upsertPing } = useMapStore();
  const { user } = useAuthStore();
  const { t } = useLanguage();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showReporterPreview, setShowReporterPreview] = useState(false);

  const ping = useMemo(
    () => pings.find((p) => p.id === selectedPingId),
    [pings, selectedPingId]
  );

  // Esc key: clear route if shown, otherwise close panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (route) {
          clearRoute();
        } else if (selectedPingId) {
          selectPing(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [route, clearRoute, selectedPingId, selectPing]);

  useEffect(() => {
    if (!selectedPingId) {
      return;
    }
    setImgError(false);
    setShowReporterPreview(false);

    let cancelled = false;

    mapApi.getPingById(Number(selectedPingId))
      .then((response) => {
        if (!cancelled) {
          upsertPing(mapBackendPing(response.data as Record<string, unknown>));
        }
      })
      .catch(() => {
        // Keep the cached ping snapshot if the detail refresh fails.
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPingId, upsertPing, user?.role]);

  if (!ping) return null;

  const config = TYPE_CONFIG[ping.type];
  const Icon = config.icon;
  const categoryConfig = ping.type === 'need_help' ? getSosCategoryConfig(ping.sosCategory) : null;
  const timeAgo = getRelativeTime(ping.createdAt, t);
  const isAdmin = user?.role === 'Admin';
  const canViewSensitiveContact = Boolean(user && user.role !== 'Guest' && user.role !== 'PersonInNeed');
  const contactName = ping.contactName || t('ping.unknownReporter');
  const contactPhone = canViewSensitiveContact ? ping.contactPhone : undefined;
  const contactEmail = canViewSensitiveContact ? ping.contactEmail : undefined;
  const hasSensitiveContact = Boolean(contactPhone || contactEmail);
  const incidentSummary = ping.description || (ping.type === 'need_help' ? t('ping.needsHelpGeneral') : t(config.label));
  const locationLabel = ping.address || `${ping.lat.toFixed(5)}, ${ping.lng.toFixed(5)}`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${ping.lat},${ping.lng}`;
  const canOpenReporterProfile = Boolean(ping.userId);
  const initials = contactName
    .split(' ')
    .map((segment) => segment[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleDeletePing = () => {
    if (!isAdmin) return;
    setShowDeleteConfirm(true);
  };

  const confirmDeletePing = async () => {
    setDeleting(true);
    try {
      await mapApi.deletePing(Number(ping.id));
      removePing(ping.id);
      selectPing(null);
      // Clear route if this ping was the destination
      if (route && route.destination.lat === ping.lat && route.destination.lng === ping.lng) {
        clearRoute();
      }
      toast.success(t('ping.deleted') || 'Ping deleted');
    } catch {
      toast.error(t('ping.deleteFailed') || 'Failed to delete ping');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDirections = () => {
    if (isRouting) return;
    fetchRoute(ping.lat, ping.lng);
  };

  const handleClose = () => {
    selectPing(null);
    // Route intentionally NOT cleared here — user must explicitly press "Clear route"
    // or click Directions on another ping to replace it.
  };

  return (
    <div className="ping-detail-panel animate-slide-in-up">
      {/* Header: badges + close */}
      <div className="ping-detail-header">
        <div className="ping-detail-type">
          <span className={`ping-type-badge ${config.colorClass}`}>
            <Icon size={13} />
            {t(config.label)}
          </span>
          {categoryConfig && (() => {
            const CategoryIcon = categoryConfig.icon;
            return (
              <span
                className="ping-type-badge"
                style={{ background: `${categoryConfig.color}18`, color: categoryConfig.color }}
              >
                <CategoryIcon size={13} />
                {t(categoryConfig.label)}
              </span>
            );
          })()}
          <span className={`ping-status-badge ping-status-${ping.status}`}>
            {t(`ping.status.${ping.status}`)}
          </span>
        </div>
        <button className="btn-ghost btn-sm" onClick={handleClose} aria-label={t('common.close')}>
          <X size={16} />
        </button>
      </div>

      {/* Reporter row — compact */}
      {canOpenReporterProfile ? (
        <button
          type="button"
          className="ping-detail-reporter ping-detail-reporter-btn"
          onClick={() => setShowReporterPreview(true)}
        >
          <div className="ping-detail-avatar">
            {ping.userAvatarUrl ? (
              <img
                src={getImageUrl(ping.userAvatarUrl)}
                alt=""
                className="ping-detail-avatar-image"
                loading="lazy"
              />
            ) : (
              initials || 'RC'
            )}
          </div>
          <div className="ping-detail-reporter-copy">
            <span className="ping-detail-eyebrow">{t('ping.reportedBy')}</span>
            <strong className="ping-detail-name">{contactName}</strong>
          </div>
        </button>
      ) : (
        <div className="ping-detail-reporter">
          <div className="ping-detail-avatar">{initials || 'RC'}</div>
          <div className="ping-detail-reporter-copy">
            <span className="ping-detail-eyebrow">{t('ping.reportedBy')}</span>
            <strong className="ping-detail-name">{contactName}</strong>
          </div>
        </div>
      )}

      {/* Emergency message — inline */}
      <div className="ping-detail-incident">
        <AlertCircle size={14} className="ping-detail-incident-icon" />
        <p className="ping-detail-incident-text">{incidentSummary}</p>
      </div>

      {/* Location + time */}
      <div className="ping-detail-info-row">
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noreferrer"
          className="ping-detail-info-item ping-detail-info-item--link"
          title={t('ping.openInGoogleMaps')}
          aria-label={t('ping.openInGoogleMaps')}
        >
          <MapPin size={12} />
          <span>{locationLabel}</span>
          <ArrowUpRight size={11} />
        </a>
        <span className="ping-detail-info-sep">·</span>
        <span className="ping-detail-info-item">
          <Clock size={12} />
          {timeAgo}
        </span>
      </div>

      {/* Contact */}
      {hasSensitiveContact && (
        <div className="ping-contact-grid">
          {contactPhone && (
            <a href={`tel:${contactPhone}`} className="ping-contact-item">
              <Phone size={13} />
              <span>{contactPhone}</span>
            </a>
          )}
          {contactEmail && (
            <a href={`mailto:${contactEmail}`} className="ping-contact-item">
              <Mail size={13} />
              <span>{contactEmail}</span>
            </a>
          )}
        </div>
      )}

      {/* Condition image */}
      {ping.conditionImageUrl && !imgError && (
        <div className="ping-detail-image-wrapper">
          <img
            src={getImageUrl(ping.conditionImageUrl)}
            alt={t('ping.conditionImageAlt')}
            className="ping-detail-image"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        </div>
      )}
      {ping.conditionImageUrl && imgError && (
        <div className="ping-detail-image-error">
          <AlertCircle size={20} />
          <span>{t('ping.imageLoadError') || 'Không thể tải ảnh'}</span>
        </div>
      )}

      {/* Items */}
      {ping.items && ping.items.length > 0 && (
        <div className="ping-items-list">
          {ping.items.map((item, i) => (
            <span key={i} className="mini-tag">{item}</span>
          ))}
        </div>
      )}

      {/* Route info */}
      {route && route.destination.lat === ping.lat && route.destination.lng === ping.lng && (() => {
        const formatDuration = (min: number) =>
          min < 60 ? `${min} ${t('ping.minutes')}` : `${Math.floor(min / 60)}h ${min % 60}m`;

        const allRoutes = [
          { label: t('ping.mainRoute'), info: route.info, index: 0, color: '#2563eb' },
          ...route.alternatives.map((alt, i) => ({
            label: `${t('ping.altRoute')} ${i + 1}`,
            info: alt.info,
            index: i + 1,
            color: i === 0 ? '#7c3aed' : '#059669',
          })),
        ];

        const selected = allRoutes[route.selectedIndex] || allRoutes[0];

        return (
          <div className="ping-route-info">
            <div className="ping-route-info-row">
              <span className="ping-route-label">{t('ping.distance')}</span>
              <span className="ping-route-value">{selected.info.distanceKm} km</span>
            </div>
            <div className="ping-route-info-row">
              <span className="ping-route-label">{t('ping.duration')}</span>
              <span className="ping-route-value">{formatDuration(selected.info.durationMin)}</span>
            </div>

            {allRoutes.length > 1 && (
              <div className="ping-route-grid">
                {allRoutes.map((r) => (
                  <button
                    key={r.index}
                    className={`ping-route-card ${route.selectedIndex === r.index ? 'ping-route-card--active' : ''}`}
                    onClick={() => selectRouteIndex(r.index)}
                  >
                    <span className="ping-route-dot" style={{ backgroundColor: r.color }} />
                    <span className="ping-route-card-label">{r.label}</span>
                    <span className="ping-route-card-stats">{r.info.distanceKm} km · {formatDuration(r.info.durationMin)}</span>
                  </button>
                ))}
              </div>
            )}

            <button className="btn btn-ghost btn-sm ping-route-clear" onClick={clearRoute}>
              <X size={12} />
              {t('ping.clearRoute')}
            </button>
          </div>
        );
      })()}

      {/* Route error */}
      {routeError && (
        <div className="ping-route-error">{routeError}</div>
      )}

      {/* CTA Buttons */}
      <div className="ping-detail-cta">
        <button
          className="ping-cta-btn ping-cta-btn--directions"
          onClick={handleDirections}
          disabled={isRouting}
        >
          {isRouting ? <Loader2 size={15} className="animate-spin" /> : <Navigation size={15} />}
          {isRouting ? t('common.loading') : t('ping.directionsTo')}
        </button>
        {hasSensitiveContact && contactPhone && (
          <a href={`tel:${contactPhone}`} className="ping-cta-btn ping-cta-btn--contact">
            <Phone size={15} />
            {t('ping.contactReporter')}
          </a>
        )}
      </div>

      {/* Admin actions */}
      {isAdmin && (
        <div className="ping-detail-admin">
          <button className="btn btn-danger btn-sm" onClick={handleDeletePing}>
            <Trash2 size={14} />
            {t('common.delete')}
          </button>
        </div>
      )}

      {/* Inline delete confirmation */}
      {showDeleteConfirm && (
        <div style={{
          marginTop: 'var(--sp-3)',
          padding: 'var(--sp-3) var(--sp-4)',
          borderRadius: 'var(--radius-md)',
          background: 'color-mix(in srgb, var(--danger-500) 8%, var(--bg-primary))',
          border: '1px solid color-mix(in srgb, var(--danger-500) 30%, transparent)',
        }}>
          <p style={{
            fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--danger-600)',
            margin: '0 0 4px',
          }}>
            <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {t('admin.confirmDeletePing') || 'Xóa ping này?'}
          </p>
          <p style={{
            fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.4,
          }}>
            {ping.description?.slice(0, 80)}{ping.description && ping.description.length > 80 ? '…' : ''}
            <br />
            <span style={{ opacity: 0.7 }}>{ping.address}</span>
          </p>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
            >
              {t('common.cancel') || 'Hủy'}
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={confirmDeletePing}
              disabled={deleting}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {t('common.delete') || 'Xóa'}
            </button>
          </div>
        </div>
      )}

      {canOpenReporterProfile && (
        <UserPreviewModal
          isOpen={showReporterPreview}
          userId={ping.userId ?? ''}
          fallbackName={contactName}
          fallbackAvatar={ping.userAvatarUrl}
          onClose={() => setShowReporterPreview(false)}
        />
      )}
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
