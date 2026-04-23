import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useMapStore, type PingType } from '../../stores/mapStore';
import { useLanguage } from '../../contexts/LanguageContext';

const COUNT_CHIPS: { type: PingType; color: string; activeColor: string }[] = [
  { type: 'need_help',     color: 'rgba(239,68,68,0.12)',   activeColor: '#ef4444' },
  { type: 'offering',      color: 'rgba(249,115,22,0.12)',  activeColor: '#f97316' },
  { type: 'received',      color: 'rgba(59,130,246,0.12)',  activeColor: '#3b82f6' },
  { type: 'support_point', color: 'rgba(34,197,94,0.12)',   activeColor: '#22c55e' },
];

export default function MobileTopBar() {
  const { activeFilters, toggleFilter, pings, selectPing, setFlyTo } = useMapStore();
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [showResults, setShowResults] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const counts = useMemo<Record<PingType, number>>(() => ({
    need_help:     pings.filter(p => p.type === 'need_help').length,
    offering:      pings.filter(p => p.type === 'offering').length,
    received:      pings.filter(p => p.type === 'received').length,
    support_point: pings.filter(p => p.type === 'support_point').length,
  }), [pings]);

  const chipLabels: Record<PingType, string> = {
    need_help:     t('filter.needHelp'),
    offering:      t('filter.offering'),
    received:      t('filter.received'),
    support_point: t('filter.supportPoint'),
  };

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    return pings
      .filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q) ||
        p.contactName?.toLowerCase().includes(q) ||
        (qDigits.length >= 4 && p.contactPhone?.replace(/\D/g, '').includes(qDigits))
      )
      .slice(0, 6);
  }, [search, pings]);

  useEffect(() => {
    if (!showResults) return;
    const handle = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setShowResults(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showResults]);

  return (
    <div className="mobile-topbar">
      {/* Search row */}
      <div className="mobile-topbar__search-wrap" ref={wrapRef}>
        <div className="mobile-topbar__search">
          <Search size={15} className="mobile-topbar__search-icon" />
          <input
            type="text"
            className="mobile-topbar__search-input"
            placeholder={t('filter.searchPlaceholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
            onFocus={() => { if (search.trim()) setShowResults(true); }}
          />
          {search && (
            <button
              type="button"
              className="mobile-topbar__clear"
              onClick={() => { setSearch(''); setShowResults(false); }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Search results dropdown */}
        {showResults && search.trim() && (
          <div className="mobile-topbar__results">
            {searchResults.length === 0 ? (
              <div className="mobile-topbar__results-empty">{t('filter.noResults')}</div>
            ) : (
              searchResults.map((ping) => (
                <button
                  key={ping.id}
                  type="button"
                  className="mobile-topbar__result-item"
                  onClick={() => {
                    selectPing(ping.id);
                    setFlyTo({ lat: ping.lat, lng: ping.lng, zoom: 15 });
                    setSearch('');
                    setShowResults(false);
                  }}
                >
                  <span className="mobile-topbar__result-title">
                    {ping.title || ping.contactName || '—'}
                  </span>
                  <span className="mobile-topbar__result-addr">{ping.address}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Count chips */}
      <div className="mobile-topbar__chips">
        {COUNT_CHIPS.map(({ type, color, activeColor }) => {
          const isActive = activeFilters.includes(type);
          return (
            <button
              key={type}
              type="button"
              className={`mobile-topbar__chip${isActive ? ' mobile-topbar__chip--active' : ''}`}
              style={
                {
                  '--chip-bg': color,
                  '--chip-active': activeColor,
                } as React.CSSProperties
              }
              onClick={() => toggleFilter(type)}
            >
              <span className="mobile-topbar__chip-count">{counts[type]}</span>
              <span className="mobile-topbar__chip-label">{chipLabels[type]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
