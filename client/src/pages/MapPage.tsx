import { MapPin, Filter, AlertTriangle, Plus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function MapPage() {
    const { t } = useLanguage();

    const filterButtons = [
        { label: t('map.needHelp'), count: 19, color: 'var(--danger-500)', bg: 'rgba(239, 68, 68, 0.12)' },
        { label: t('map.offering'), count: 7, color: 'var(--primary-400)', bg: 'rgba(249, 115, 22, 0.12)' },
        { label: t('map.received'), count: 482, color: 'var(--success-500)', bg: 'rgba(34, 197, 94, 0.12)' },
        { label: t('map.supportPoint'), count: 37, color: 'var(--accent-400)', bg: 'rgba(6, 182, 212, 0.12)' },
    ];

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', margin: 'calc(-1 * var(--space-6))', marginTop: 'calc(-1 * var(--space-6))' }}>
            {/* Top Filter Bar */}
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
                {filterButtons.map((f) => (
                    <button
                        key={f.label}
                        className="btn btn-sm"
                        style={{ background: f.bg, color: f.color, border: 'none', whiteSpace: 'nowrap' }}
                    >
                        <span style={{ fontWeight: 700 }}>{f.count}</span> {f.label}
                    </button>
                ))}
            </div>

            {/* Map placeholder */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', position: 'relative' }}>
                <div className="empty-state animate-fade-in-up">
                    <div className="empty-state__icon" style={{ width: 80, height: 80 }}>
                        <MapPin size={36} />
                    </div>
                    <div className="empty-state__title">{t('map.title')}</div>
                    <div className="empty-state__desc">
                        {t('landing.feature1Desc')}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                        <button className="btn btn-danger btn-sm">
                            <AlertTriangle size={14} /> {t('map.createSOS')}
                        </button>
                        <button className="btn btn-primary btn-sm">
                            <Plus size={14} /> {t('map.createSupply')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
