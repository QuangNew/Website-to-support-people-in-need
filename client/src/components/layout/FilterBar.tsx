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
    return pings
      .filter(p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.address.toLowerCase().includes(q))
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
      <div className="filter-search" ref={searchWrapperRef} style={{ position: 'relative' }}>
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
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8,
            minWidth: 320, maxHeight: 360, overflowY: 'auto',
            background: 'var(--bg-primary)', borderRadius: 12,
            border: '1px solid color-mix(in srgb, var(--text-muted) 15%, transparent)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.08)',
            zIndex: 1000,
          }}>
            {searchResults.length === 0 ? (
              <div style={{ padding: '12px 16px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                {t('filter.noResults')}
              </div>
            ) : (
              searchResults.map(ping => (
                <button
                  key={ping.id}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 2, width: '100%',
                    padding: '10px 16px', background: 'none', border: 'none',
                    borderBottom: '1px solid color-mix(in srgb, var(--text-muted) 10%, transparent)',
                    cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  onClick={() => {
                    setFlyTo({ lat: ping.lat, lng: ping.lng, zoom: 14 });
                    selectPing(ping.id);
                    setShowResults(false);
                    setSearch('');
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                      background: TYPE_COLORS[ping.type] ?? '#888', color: '#fff',
                    }}>
                      {TYPE_LABELS[ping.type] ?? ping.type}
                    </span>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ping.title}
                    </span>
                  </div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ping.address}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Notification bell */}
      <NotificationBell />
    </div>
  );
}
