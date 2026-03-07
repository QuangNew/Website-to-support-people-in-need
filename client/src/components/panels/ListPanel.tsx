import { useMemo } from 'react';
import {
  AlertTriangle,
  Gift,
  CheckCircle2,
  MapPin,
  Clock,
  ChevronRight,
  Inbox,
} from 'lucide-react';
import { useMapStore, type PingData, type PingType } from '../../stores/mapStore';
import { useLanguage } from '../../contexts/LanguageContext';

const TYPE_ICON: Record<PingType, typeof AlertTriangle> = {
  need_help: AlertTriangle,
  offering: Gift,
  received: CheckCircle2,
  support_point: MapPin,
};

const TYPE_COLOR: Record<PingType, string> = {
  need_help: 'var(--danger-500)',
  offering: 'var(--success-500)',
  received: 'var(--accent-500)',
  support_point: 'var(--primary-500)',
};

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
            const Icon = TYPE_ICON[ping.type];
            return (
              <button
                key={ping.id}
                className="list-item hover-lift"
                onClick={() => handleSelectPing(ping)}
              >
                <div
                  className="list-item-icon"
                  style={{ color: TYPE_COLOR[ping.type], backgroundColor: `${TYPE_COLOR[ping.type]}15` }}
                >
                  <Icon size={18} />
                </div>
                <div className="list-item-content">
                  <h4 className="list-item-title">{ping.title}</h4>
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
