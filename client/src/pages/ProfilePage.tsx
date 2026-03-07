import { Mail, Calendar, Shield, Edit3 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuthStore } from '../stores/authStore';

export default function ProfilePage() {
    const { t } = useLanguage();
    const user = useAuthStore((s) => s.user);

    const initials = user?.fullName
        ? user.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
        : '?';

    const getRoleBadge = (role: string) => {
        const map: Record<string, { cls: string; label: string }> = {
            Admin: { cls: 'badge-danger', label: t('roles.admin') },
            Volunteer: { cls: 'badge-accent', label: t('roles.volunteer') },
            Sponsor: { cls: 'badge-primary', label: t('roles.sponsor') },
            PersonInNeed: { cls: 'badge-warning', label: t('roles.personInNeed') },
        };
        return map[role] || { cls: 'badge-neutral', label: t('roles.guest') };
    };

    const roleBadge = getRoleBadge(user?.role || 'Guest');

    return (
        <div className="animate-fade-in-up" style={{ maxWidth: 640, margin: '0 auto' }}>
            <div className="page-header">
                <div className="page-header__info">
                    <h1 className="page-header__title">{t('profile.title')}</h1>
                </div>
                <button className="btn btn-secondary btn-sm">
                    <Edit3 size={14} /> {t('profile.editProfile')}
                </button>
            </div>

            {/* Profile Card */}
            <div className="glass-card" style={{ padding: 'var(--space-8)', textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                <div className="avatar avatar-2xl" style={{ margin: '0 auto var(--space-5)' }}>
                    {initials}
                </div>
                <h2 style={{ marginBottom: 'var(--space-2)' }}>{user?.fullName || 'User'}</h2>
                <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-3)' }}>@{user?.userName || 'username'}</p>
                <span className={`badge ${roleBadge.cls} badge-lg`}>{roleBadge.label}</span>
            </div>

            {/* Info */}
            <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <Mail size={18} style={{ color: 'var(--text-tertiary)' }} />
                        <div>
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{t('auth.email')}</div>
                            <div style={{ fontWeight: 500 }}>{user?.email || '—'}</div>
                        </div>
                    </div>
                    <div className="divider" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <Shield size={18} style={{ color: 'var(--text-tertiary)' }} />
                        <div>
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{t('profile.role')}</div>
                            <div style={{ fontWeight: 500 }}>{roleBadge.label}</div>
                        </div>
                    </div>
                    <div className="divider" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <Calendar size={18} style={{ color: 'var(--text-tertiary)' }} />
                        <div>
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{t('profile.joinedAt')}</div>
                            <div style={{ fontWeight: 500 }}>2026</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
