import { useState } from 'react';
import { Search, X, AlertTriangle, Gift, CheckCircle2, MapPin, Layers } from 'lucide-react';
import { useMapStore, type PingType } from '../../stores/mapStore';
import { useLanguage } from '../../contexts/LanguageContext';

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
  const { activeFilters, toggleFilter, showZones, toggleZones } = useMapStore();
  const { t } = useLanguage();
  const [search, setSearch] = useState('');

  return (
    <div className="filter-bar">
      {/* Search input */}
      <div className="filter-search">
        <Search size={16} className="filter-search-icon" />
        <input
          type="text"
          className="filter-search-input"
          placeholder={t('filter.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="filter-search-clear" onClick={() => setSearch('')}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="filter-chips">
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
      </div>
    </div>
  );
}
