import { Filter, AlertTriangle, Package, CheckCircle, MapPin } from 'lucide-react';
import { useMapStore } from '../../stores/mapStore';
import { useLanguage } from '../../contexts/LanguageContext';

export default function FilterBar() {
    const { t } = useLanguage();
    const { activeFilters, toggleFilter } = useMapStore();

    const filters = [
        { type: 'need_help' as const, label: t('map.needHelp'), icon: AlertTriangle, color: '#ef4444' },
        { type: 'offering' as const, label: t('map.offering'), icon: Package, color: '#22c55e' },
        { type: 'received' as const, label: t('map.received'), icon: CheckCircle, color: '#f59e0b' },
        { type: 'support_point' as const, label: t('map.supportPoint'), icon: MapPin, color: '#f97316' },
    ];

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--glass-bg)', backdropFilter: 'blur(20px)',
            borderBottom: '1px solid var(--border-subtle)',
            overflowX: 'auto', flexShrink: 0,
        }}>
            <button className="btn btn-secondary btn-sm">
                <Filter size={14} /> {t('map.filters')}
            </button>
            <div style={{ width: 1, height: 24, background: 'var(--border-subtle)' }} />
            {filters.map((f) => (
                <button
                    key={f.type}
                    className="btn btn-sm"
                    style={{
                        background: activeFilters.includes(f.type) ? `${f.color}20` : 'transparent',
                        color: f.color,
                        border: `1px solid ${f.color}40`,
                        whiteSpace: 'nowrap'
                    }}
                    onClick={() => toggleFilter(f.type)}
                >
                    <f.icon size={14} /> {f.label}
                </button>
            ))}
        </div>
    );
}
