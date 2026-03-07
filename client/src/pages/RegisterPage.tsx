import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Mail, Lock, User, Eye, EyeOff, ArrowRight, Sun, Moon, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: '',
    username: '',
    fullName: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { locale, toggleLocale } = useLanguage();

  const updateField = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error(t('auth.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      await register({ email: form.email, username: form.username, fullName: form.fullName, password: form.password });
      toast.success(t('auth.registerSuccess'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('auth.registerError');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      {/* Top-right controls */}
      <div style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 100 }}>
        <button className="btn btn-ghost btn-icon" onClick={toggleLocale} title={locale === 'vi' ? 'English' : 'Tiếng Việt'}>
          <Globe size={18} />
        </button>
        <button className="btn btn-ghost btn-icon" onClick={toggleTheme} title={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="auth-container animate-fade-in-up">
        {/* Logo */}
        <div className="auth-header">
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 'var(--radius-xl)', background: 'linear-gradient(135deg, var(--primary-500), var(--accent-500))', marginBottom: 'var(--space-5)', boxShadow: 'var(--shadow-glow-accent)' }}>
            <Heart size={28} color="white" />
          </div>
          <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-2)' }}>
            {t('auth.registerTitle')}
          </h1>
          <p style={{ color: 'var(--text-tertiary)' }}>
            {t('auth.registerSubtitle')}
          </p>
        </div>

        {/* Form */}
        <div className="glass-card auth-card">
          <form onSubmit={handleSubmit}>
            {/* Full Name + Username */}
            <div className="form-row">
              <div className="input-group">
                <label htmlFor="reg-fullname">{t('auth.fullName')}</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    id="reg-fullname"
                    type="text"
                    className="input"
                    style={{ paddingLeft: 40 }}
                    placeholder="Nguyễn Văn A"
                    value={form.fullName}
                    onChange={updateField('fullName')}
                    required
                    autoComplete="name"
                  />
                </div>
              </div>
              <div className="input-group">
                <label htmlFor="reg-username">{t('auth.username')}</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    id="reg-username"
                    type="text"
                    className="input"
                    style={{ paddingLeft: 40 }}
                    placeholder="nguyenvana"
                    value={form.username}
                    onChange={updateField('username')}
                    required
                    autoComplete="username"
                  />
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="input-group">
              <label htmlFor="reg-email">{t('auth.email')}</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input
                  id="reg-email"
                  type="email"
                  className="input"
                  style={{ paddingLeft: 40 }}
                  placeholder="name@example.com"
                  value={form.email}
                  onChange={updateField('email')}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div className="input-group">
              <label htmlFor="reg-password">{t('auth.password')}</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  style={{ paddingLeft: 40, paddingRight: 44 }}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={updateField('password')}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 8 }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="input-group">
              <label htmlFor="reg-confirm">{t('auth.confirmPassword')}</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input
                  id="reg-confirm"
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  style={{ paddingLeft: 40 }}
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={updateField('confirmPassword')}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn btn-primary btn-lg btn-full"
              disabled={loading || !form.email || !form.password || !form.username || !form.fullName}
              style={{ marginTop: 'var(--space-2)' }}
            >
              {loading ? (
                <>
                  <span className="spinner spinner-sm" />
                  {t('auth.registering')}
                </>
              ) : (
                <>
                  {t('auth.register')}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="auth-footer">
          {t('auth.hasAccount')}{' '}
          <Link to="/login">{t('auth.login')}</Link>
        </div>
      </div>
    </div>
  );
}
