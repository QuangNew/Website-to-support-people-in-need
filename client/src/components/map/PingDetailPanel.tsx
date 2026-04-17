import { useMemo, useState } from 'react';
import {
  X,
  AlertCircle,
  AlertTriangle,
  Gift,
  CheckCircle2,
  Heart,
  Home,
  MapPin,
  Phone,
  Package,
  Navigation,
  Loader2,
  Trash2,
  UtensilsCrossed,
  Mail,
  Camera,
} from 'lucide-react';
import { useMapStore, type PingType } from '../../stores/mapStore';
import { useAuthStore } from '../../stores/authStore';
import { useLanguage } from '../../contexts/LanguageContext';
import { getImageUrl, mapApi } from '../../services/api';
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
  const { selectedPingId, pings, selectPing, fetchRoute, clearRoute, selectRouteIndex, route, isRouting, routeError, removePing } = useMapStore();
  const { user } = useAuthStore();
  const { t } = useLanguage();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const ping = useMemo(
    () => pings.find((p) => p.id === selectedPingId),
    [pings, selectedPingId]
  );

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
      {/* Header with close button */}
      <div className="ping-detail-header">
        <div className="ping-detail-type">
          <span className={`ping-type-badge ${config.colorClass}`}>
            <Icon size={14} />
            {t(config.label)}
          </span>
          {categoryConfig && (() => {
            const CategoryIcon = categoryConfig.icon;
            return (
              <span
                className="ping-type-badge"
                style={{ background: `${categoryConfig.color}18`, color: categoryConfig.color }}
              >
                <CategoryIcon size={14} />
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

      {/* Hero: Reporter Profile Card — Only shown ONCE */}
      <div className="ping-detail-hero">
        <div className="ping-detail-reporter">
          <div className="ping-detail-avatar">{initials || 'RC'}</div>
          <div className="ping-detail-reporter-copy">
            <span className="ping-detail-eyebrow">{t('ping.reportedBy')}</span>
            <h3 className="ping-detail-title">{contactName}</h3>
            <p className="ping-detail-subtitle">{timeAgo}</p>
          </div>
        </div>
      </div>

      {/* Incident Summary — HIGHLIGHTED in a prominent block */}
      {incidentSummary && (
        <div className="ping-detail-incident-block">
          <div className="ping-incident-icon">
            <AlertCircle size={18} />
          </div>
          <div className="ping-incident-content">
            <span className="ping-incident-label">{t('ping.description') || 'Yêu cầu'}</span>
            <p className="ping-incident-text">{incidentSummary}</p>
          </div>
        </div>
      )}

      {/* Meta Info Grid — Location & Details (Compact horizontal row) */}
      <div className="ping-detail-meta-grid">
        <div className="ping-detail-meta-card">
          <span className="ping-detail-meta-label">
            <MapPin size={14} />
            {t('ping.locationLabel')}
          </span>
          <span className="ping-detail-meta-value">{locationLabel}</span>
        </div>
        <div className="ping-detail-meta-card">
          <span className="ping-detail-meta-label">
            <Package size={14} />
            {t('ping.items')}
          </span>
          <span className="ping-detail-meta-value">
            {ping.items && ping.items.length > 0 ? ping.items.join(', ') : (t('ping.notSpecified') || 'Chưa chỉ rõ')}
          </span>
        </div>
      </div>

      {/* Condition Image — If available */}
      {ping.conditionImageUrl && (
        <div className="ping-detail-card ping-detail-card--visual">
          <div className="ping-detail-card-head">
            <span className="ping-detail-card-title">
              <Camera size={14} />
              {t('ping.conditionImageLabel')}
            </span>
            <span className="ping-detail-card-caption">{t('ping.conditionImageCaption')}</span>
          </div>
          <img
            src={getImageUrl(ping.conditionImageUrl)}
            alt={t('ping.conditionImageAlt')}
            className="ping-detail-image"
          />
        </div>
      )}

      {/* Contact Information Card */}
      {hasSensitiveContact && (
        <div className="ping-detail-card">
          <div className="ping-detail-card-head">
            <span className="ping-detail-card-title">
              <Phone size={14} />
              {t('ping.contactSectionTitle')}
            </span>
            <span className="ping-detail-card-caption">
              {t('ping.contactSectionResponders')}
            </span>
          </div>

          <div className="ping-contact-grid">
            {contactPhone && (
              <a href={`tel:${contactPhone}`} className="ping-contact-item ping-contact-item--link">
                <Phone size={14} />
                <div>
                  <span className="ping-contact-label">{t('ping.contactPhoneLabel')}</span>
                  <strong>{contactPhone}</strong>
                </div>
              </a>
            )}

            {contactEmail && (
              <a href={`mailto:${contactEmail}`} className="ping-contact-item ping-contact-item--link">
                <Mail size={14} />
                <div>
                  <span className="ping-contact-label">{t('ping.contactEmailLabel')}</span>
                  <strong>{contactEmail}</strong>
                </div>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Route Info */}
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
          <div className="ping-detail-card ping-route-info">
            {/* Selected route summary */}
            <div className="ping-route-info-row">
              <span className="ping-route-label">{t('ping.distance')}</span>
              <span className="ping-route-value">{selected.info.distanceKm} km</span>
            </div>
            <div className="ping-route-info-row">
              <span className="ping-route-label">{t('ping.duration')}</span>
              <span className="ping-route-value">{formatDuration(selected.info.durationMin)}</span>
            </div>

            {/* Route selector (only if multiple routes) */}
            {allRoutes.length > 1 && (
              <>
                <p className="ping-route-note">{t('ping.routeCompareHint')}</p>
                <div className="ping-route-grid">
                  {allRoutes.map((r) => (
                    <button
                      key={r.index}
                      className={`ping-route-card ${route.selectedIndex === r.index ? 'ping-route-card--active' : ''}`}
                      onClick={() => selectRouteIndex(r.index)}
                    >
                      <div className="ping-route-card-head">
                        <span className="ping-route-card-title">
                          <span className="ping-route-dot" style={{ backgroundColor: r.color }} />
                          {r.label}
                        </span>
                        {route.selectedIndex === r.index && (
                          <span className="mini-tag">{t('ping.selectedRoute')}</span>
                        )}
                      </div>
                      <span className="ping-route-card-stats">
                        <span>{r.info.distanceKm} km</span>
                        <span>{formatDuration(r.info.durationMin)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {allRoutes.length > 1 && (
              <div className="ping-route-selector">
                {allRoutes.map((r) => (
                  <button
                    key={r.index}
                    className={`ping-route-option ${route.selectedIndex === r.index ? 'ping-route-option--active' : ''}`}
                    onClick={() => selectRouteIndex(r.index)}
                  >
                    <span className="ping-route-option-label">{r.label}</span>
                    <span className="ping-route-option-info">{r.info.distanceKm} km · {formatDuration(r.info.durationMin)}</span>
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
        <div className="ping-route-error">
          {routeError}
        </div>
      )}

      {/* CTA Actions — Prominent buttons at bottom */}
      <div className="ping-detail-actions ping-detail-actions--cta">
        {/* Main CTA: Directions */}
        <button
          className="btn btn-primary ping-cta-btn ping-cta-btn--primary"
          onClick={handleDirections}
          disabled={isRouting}
        >
          {isRouting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>{t('common.loading')}</span>
            </>
          ) : (
            <>
              <Navigation size={16} />
              <span>{t('ping.directions') || 'Chỉ đường'}</span>
            </>
          )}
        </button>

        {/* Secondary CTA: Contact */}
        {hasSensitiveContact && contactPhone && (
          <a
            href={`tel:${contactPhone}`}
            className="btn btn-secondary ping-cta-btn ping-cta-btn--contact"
          >
            <Phone size={16} />
            <span>{t('ping.callPerson') || 'Liên hệ'}</span>
          </a>
        )}

        {/* Support button for active SOS */}
        {ping.type === 'need_help' && ping.status === 'active' && (
          <button className="btn btn-accent btn-sm">
            <Gift size={14} />
            {t('ping.support')}
          </button>
        )}

        {/* Admin delete button */}
        {isAdmin && (
          <button
            className="btn btn-danger btn-sm"
            onClick={handleDeletePing}
          >
            <Trash2 size={14} />
            {t('common.delete')}
          </button>
        )}
      </div>

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
