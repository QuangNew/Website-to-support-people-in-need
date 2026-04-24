import { useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Gift,
  CheckCircle2,
  MapPin,
  Clock,
  ChevronRight,
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

export default function ListPanel() {
  const { pings, activeFilters, selectPing, setActivePanel } = useMapStore();
  const { t } = useLanguage();

  const filteredPings = useMemo(
    () => pings.filter((p) => activeFilters.includes(p.type) && p.status === 'active'),
    [pings, activeFilters]
  );

  const handleSelectPing = (ping: PingData) => {
    selectPing(ping.id);
    setActivePanel(null);
  };

  return (
    <div className="panel-content">
      <div className="panel-header">
        <h2 className="panel-title">{t('panel.requestList')}</h2>
        <span className="badge badge-primary">{filteredPings.length}</span>
      </div>

      {filteredPings.length === 0 ? (
        <div className="empty-state">
          <Inbox size={48} strokeWidth={1.5} />
          <p>{t('panel.noResults')}</p>
        </div>
      ) : (
        <div className="panel-list">
          {filteredPings.map((ping) => {
            const visual = getPingVisual(ping);
            const Icon = visual.icon;
            const CategoryIcon = visual.categoryIcon;
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
                  <span className="list-item-time">
                    <Clock size={12} />
                    {getShortTime(ping.createdAt)}
                  </span>
                  <ChevronRight size={14} className="list-item-arrow" />
                </div>
              </button>
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
