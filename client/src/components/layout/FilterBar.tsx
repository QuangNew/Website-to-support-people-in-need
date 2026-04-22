import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, AlertTriangle, Gift, CheckCircle2, MapPin, Layers, Package, SlidersHorizontal } from 'lucide-react';
import { useMapStore, type PingType } from '../../stores/mapStore';
import { useLanguage } from '../../contexts/LanguageContext';
import NotificationBell from '../ui/NotificationBell';

interface FilterChip {
  type: PingType;
  labelKey: string;
  icon: React.ReactNode;
  color: string;
}

const FILTER_CHIPS: FilterChip[] = [
  { type: 'need_help', labelKey: 'filter.needHelp', icon: <AlertTriangle size={14} />, color: 'var(--danger-500)' },
  { type: 'offering', labelKey: 'filter.offering', icon: <Gift size={14} />, color: 'var(--success-500)' },
  { type: 'received', labelKey: 'filter.received', icon: <CheckCircle2 size={14} />, color: 'var(--accent-500)' },
  { type: 'support_point', labelKey: 'filter.supportPoint', icon: <MapPin size={14} />, color: 'var(--primary-500)' },
];

export default function FilterBar() {
  const { activeFilters, toggleFilter, showZones, toggleZones, showSupplyPoints, toggleSupplyPoints, pings, selectPing, setFlyTo } = useMapStore();
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  // Filter pings by search text
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    return pings
      .filter(p =>
        p.title.toLowerCase().includes(q)
        || p.description.toLowerCase().includes(q)
        || p.address.toLowerCase().includes(q)
        || p.contactName?.toLowerCase().includes(q)
        || (qDigits.length >= 4 && p.contactPhone?.replace(/\D/g, '').includes(qDigits))
      )
      .slice(0, 8);
  }, [search, pings]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showResults) return;
    const handle = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node))
        setShowResults(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showResults]);

  const TYPE_LABELS: Record<string, string> = {
    need_help: t('filter.typeLabels.need_help'),
    offering: t('filter.typeLabels.offering'),
    received: t('filter.typeLabels.received'),
    support_point: t('filter.typeLabels.support_point'),
  };
  const TYPE_COLORS: Record<string, string> = { need_help: '#ef4444', offering: '#22c55e', received: '#f59e0b', support_point: '#f97316' };

  return (
    <div className={`filter-bar ${expanded ? 'filter-bar-expanded' : ''}`}>
      {/* Expand/collapse button */}
      <button
        className={`filter-expand-btn ${expanded ? 'filter-expand-active' : ''}`}
        onClick={() => setExpanded(!expanded)}
        title={t('filter.toggle')}
      >
        <SlidersHorizontal size={16} />
      </button>

      {/* Filter chips (hidden when collapsed) */}
      {expanded && (
        <div className="filter-chips animate-fade-in">
          {FILTER_CHIPS.map(({ type, labelKey, icon, color }) => {
            const isActive = activeFilters.includes(type);
            return (
              <button
                key={type}
                className={`filter-chip ${isActive ? 'filter-chip-active' : ''}`}
                onClick={() => toggleFilter(type)}
                style={isActive ? { '--chip-color': color } as React.CSSProperties : undefined}
              >
                <span
                  className="filter-chip-dot"
                  style={{ backgroundColor: isActive ? color : 'var(--text-muted)' }}
                />
                {icon}
                <span className="filter-chip-label">{t(labelKey)}</span>
              </button>
            );
          })}

          {/* Zone toggle */}
          <button
            className={`filter-chip ${showZones ? 'filter-chip-active' : ''}`}
            onClick={toggleZones}
            style={showZones ? { '--chip-color': 'var(--warning-500)' } as React.CSSProperties : undefined}
          >
            <span
              className="filter-chip-dot"
              style={{ backgroundColor: showZones ? 'var(--warning-500)' : 'var(--text-muted)' }}
            />
            <Layers size={14} />
            <span className="filter-chip-label">{t('filter.zones')}</span>
          </button>

          {/* Supply points toggle */}
          <button
            className={`filter-chip ${showSupplyPoints ? 'filter-chip-active' : ''}`}
            onClick={toggleSupplyPoints}
            style={showSupplyPoints ? { '--chip-color': 'var(--info-500, #3b82f6)' } as React.CSSProperties : undefined}
          >
            <span
              className="filter-chip-dot"
              style={{ backgroundColor: showSupplyPoints ? 'var(--info-500, #3b82f6)' : 'var(--text-muted)' }}
            />
            <Package size={14} />
            <span className="filter-chip-label">{t('filter.supply')}</span>
          </button>
        </div>
      )}

      {/* Search input with ping search dropdown */}
      <div className="filter-search" ref={searchWrapperRef}>
        <input
          type="text"
          className="filter-search-input"
          placeholder={t('filter.searchPlaceholder')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
          onFocus={() => { if (search.trim()) setShowResults(true); }}
        />
        {search ? (
          <button className="filter-search-clear" onClick={() => { setSearch(''); setShowResults(false); }}>
            <X size={14} />
          </button>
        ) : (
          <Search size={16} className="filter-search-icon" />
        )}

        {/* Search results dropdown */}
        {showResults && search.trim() && (
          <div className="filter-search-results">
            {searchResults.length === 0 ? (
              <div className="filter-search-results-empty">
                {t('filter.noResults')}
              </div>
            ) : (
              searchResults.map(ping => (
                <button
                  key={ping.id}
                  type="button"
                  className="filter-search-result"
                  onClick={() => {
                    setFlyTo({ lat: ping.lat, lng: ping.lng, zoom: 14 });
                    selectPing(ping.id);
                    setShowResults(false);
                    setSearch('');
                  }}
                >
                  <div className="filter-search-result-row">
                    <span
                      className="filter-search-result-type"
                      style={{ backgroundColor: TYPE_COLORS[ping.type] ?? '#888' }}
                    >
                      {TYPE_LABELS[ping.type] ?? ping.type}
                    </span>
                    <span className="filter-search-result-title">
                      {ping.title}
                    </span>
                  </div>
                  <span className="filter-search-result-address">
                    {ping.address}
                    {ping.contactPhone && (
                      <span style={{ opacity: 0.7, marginLeft: '0.4em' }}>· {ping.contactPhone}</span>
                    )}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Notification bell */}
      <div className="filter-bar-notifications">
        <NotificationBell />
      </div>
    </div>
  );
}
