import { AlertTriangle, HandHeart, CheckCircle2, Users, MapPin, Plus, MessageCircle, TrendingUp } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuthStore } from '../stores/authStore';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { t } = useLanguage();
  const user = useAuthStore((s) => s.user);

  const stats = [
    { label: t('dashboard.stats.needHelp'), value: '24', icon: AlertTriangle, variant: 'danger' as const, trend: '+3' },
    { label: t('dashboard.stats.offering'), value: '18', icon: HandHeart, variant: 'primary' as const, trend: '+5' },
    { label: t('dashboard.stats.resolved'), value: '156', icon: CheckCircle2, variant: 'success' as const, trend: '+12' },
    { label: t('dashboard.stats.volunteers'), value: '89', icon: Users, variant: 'accent' as const, trend: '+7' },
  ];

  const quickActions = [
    { label: t('map.createSOS'), icon: AlertTriangle, to: '/map', color: 'var(--danger-500)', bg: 'rgba(239, 68, 68, 0.1)' },
    { label: t('map.createSupply'), icon: Plus, to: '/map', color: 'var(--primary-400)', bg: 'rgba(249, 115, 22, 0.1)' },
    { label: t('social.createPost'), icon: MessageCircle, to: '/social', color: 'var(--accent-400)', bg: 'rgba(6, 182, 212, 0.1)' },
    { label: t('nav.map'), icon: MapPin, to: '/map', color: 'var(--success-500)', bg: 'rgba(34, 197, 94, 0.1)' },
  ];

  const recentActivity = [
    { type: 'sos', title: 'Cần nước sạch gấp', location: 'Quận 8, TP.HCM', time: '5 phút trước', status: 'pending' },
    { type: 'supply', title: 'Gạo + mì gói (50 phần)', location: 'Quận 1, TP.HCM', time: '15 phút trước', status: 'inProgress' },
    { type: 'resolved', title: 'Đã phát thuốc y tế', location: 'Bình Dương', time: '1 giờ trước', status: 'resolved' },
    { type: 'volunteer', title: 'Tình nguyện viên mới', location: 'Đà Nẵng', time: '2 giờ trước', status: 'verified' },
    { type: 'sos', title: 'Cần chỗ trú tạm', location: 'Quảng Nam', time: '3 giờ trước', status: 'inProgress' },
  ];

  const getStatusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      pending: { cls: 'badge-warning', label: t('status.pending') },
      inProgress: { cls: 'badge-info', label: t('status.inProgress') },
      resolved: { cls: 'badge-success', label: t('status.resolved') },
      verified: { cls: 'badge-accent', label: t('status.verified') },
    };
    return map[status] || { cls: 'badge-neutral', label: status };
  };

  return (
    <div className="animate-fade-in-up">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-header__title">
            {t('dashboard.welcome')}, {user?.fullName?.split(' ').pop() || 'User'} 👋
          </h1>
          <p className="page-header__subtitle">{t('dashboard.subtitle')}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-4 animate-stagger" style={{ marginBottom: 'var(--space-6)' }}>
        {stats.map((stat) => (
          <div key={stat.label} className="glass-card glass-card--interactive stat-card">
            <div className={`stat-card__icon stat-card__icon--${stat.variant}`}>
              <stat.icon size={22} />
            </div>
            <div>
              <div className="stat-card__value">{stat.value}</div>
              <div className="stat-card__label">{stat.label}</div>
            </div>
            {stat.trend && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2, color: 'var(--success-500)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                <TrendingUp size={14} />
                {stat.trend}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 'var(--space-6)' }}>
        {/* Recent Activity */}
        <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
            <h3 style={{ fontSize: 'var(--text-lg)' }}>{t('dashboard.recentActivity')}</h3>
            <Link to="/map" className="btn btn-ghost btn-sm">{t('common.viewMore')}</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {recentActivity.map((item, i) => {
              const badge = getStatusBadge(item.status);
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-4)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--glass-bg)',
                    transition: 'background var(--transition-fast)',
                    cursor: 'pointer',
                  }}
                  className="hover-lift"
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.type === 'sos' ? 'var(--danger-500)' : item.type === 'supply' ? 'var(--primary-400)' : 'var(--success-500)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, marginBottom: 2, fontSize: 'var(--text-base)' }} className="truncate">{item.title}</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={12} /> {item.location} · {item.time}
                    </div>
                  </div>
                  <span className={`badge ${badge.cls}`}>{badge.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-5)' }}>{t('dashboard.quickActions')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {quickActions.map((action) => (
              <Link
                key={action.label}
                to={action.to}
                className="hover-lift"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  background: action.bg,
                  textDecoration: 'none',
                  color: 'var(--text-primary)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: action.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color }}>
                  <action.icon size={20} />
                </div>
                <span style={{ fontWeight: 500 }}>{action.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
