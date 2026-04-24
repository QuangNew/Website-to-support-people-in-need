import { useState } from 'react';
import { Mail, Calendar, Shield, Edit3, Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../services/api';

export default function ProfilePage() {
    const { t } = useLanguage();
    const user = useAuthStore((s) => s.user);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [changingPw, setChangingPw] = useState(false);

    const initials = user?.fullName
        ? user.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
        : '?';

    const getRoleBadge = (role: string) => {
        const map: Record<string, { cls: string; label: string }> = {
            Admin:        { cls: 'badge-danger',  label: t('roles.admin')        },
            Volunteer:    { cls: 'badge-accent',  label: t('roles.volunteer')    },
            Sponsor:      { cls: 'badge-primary', label: t('roles.sponsor')      },
            PersonInNeed: { cls: 'badge-warning', label: t('roles.personInNeed') },
        };
        return map[role] ?? { cls: 'badge-neutral', label: t('roles.guest') };
    };

    const roleBadge = getRoleBadge(user?.role || 'Guest');

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword) {
            toast.error(t('auth.fillAll'));
            return;
        }
        if (newPassword.length < 8) {
            toast.error('Mật khẩu mới phải có ít nhất 8 ký tự');
            return;
        }
        setChangingPw(true);
        try {
            await authApi.changePassword({ currentPassword, newPassword });
            toast.success('Đổi mật khẩu thành công!');
            setCurrentPassword('');
            setNewPassword('');
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            toast.error(axiosErr?.response?.data?.message || 'Đổi mật khẩu thất bại');
        } finally {
            setChangingPw(false);
        }
    };

    return (
        <div className="animate-fade-in-up" style={{ maxWidth: 640, margin: '0 auto' }}>
            <div className="page-header">
                <div className="page-header__info">
                    <h1 className="page-header__title" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                        {t('profile.title')}
                    </h1>
                </div>
                <button className="btn btn-secondary btn-sm">
                    <Edit3 size={14} /> {t('profile.editProfile')}
                </button>
            </div>

            {/* Profile Card */}
            <div className="glass-card" style={{ padding: 'var(--sp-8)', textAlign: 'center', marginBottom: 'var(--sp-6)' }}>
                <div className="avatar avatar-2xl" style={{ margin: '0 auto var(--sp-5)' }}>
                    {initials}
                </div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 'var(--sp-2)' }}>
                    {user?.fullName || 'User'}
                </h2>
                <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--sp-3)' }}>
                    @{user?.userName || 'username'}
                </p>
                <span className={`badge ${roleBadge.cls} badge-lg`}>{roleBadge.label}</span>
            </div>

            {/* Info */}
            <div className="glass-card" style={{ padding: 'var(--sp-6)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                        <Mail size={18} style={{ color: 'var(--text-tertiary)' }} />
                        <div>
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{t('auth.email')}</div>
                            <div style={{ fontWeight: 500 }}>{user?.email || '—'}</div>
                        </div>
                    </div>
                    <div className="divider" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                        <Shield size={18} style={{ color: 'var(--text-tertiary)' }} />
                        <div>
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{t('profile.role')}</div>
                            <div style={{ fontWeight: 500 }}>{roleBadge.label}</div>
                        </div>
                    </div>
                    <div className="divider" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                        <Calendar size={18} style={{ color: 'var(--text-tertiary)' }} />
                        <div>
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{t('profile.joinedAt')}</div>
                            <div style={{ fontWeight: 500 }}>2026</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Change Password */}
            <div className="glass-card" style={{ padding: 'var(--sp-6)', marginTop: 'var(--sp-6)' }}>
                <h3 style={{ margin: '0 0 var(--sp-4)', fontFamily: 'var(--font-display)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                    <Lock size={18} /> Đổi mật khẩu
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                    <div>
                        <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Mật khẩu hiện tại</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showCurrent ? 'text' : 'password'}
                                className="form-input"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="••••••••"
                                style={{ width: '100%', paddingRight: 40 }}
                            />
                            <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Mật khẩu mới</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showNew ? 'text' : 'password'}
                                className="form-input"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="••••••••"
                                style={{ width: '100%', paddingRight: 40 }}
                            />
                            <button type="button" onClick={() => setShowNew(!showNew)}
                                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={handleChangePassword} disabled={changingPw}
                        style={{ alignSelf: 'flex-start', marginTop: 'var(--sp-1)' }}>
                        {changingPw ? <span className="spinner spinner-sm" /> : 'Đổi mật khẩu'}
                    </button>
                </div>
            </div>
        </div>
    );
}
