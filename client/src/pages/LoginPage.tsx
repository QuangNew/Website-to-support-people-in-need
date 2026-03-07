import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon, Globe } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { locale, toggleLocale } = useLanguage();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      await login(email, password);
      toast.success(t('auth.loginSuccess'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('auth.loginError');
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
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 'var(--radius-xl)', background: 'linear-gradient(135deg, var(--primary-500), var(--danger-500))', marginBottom: 'var(--space-5)', boxShadow: 'var(--shadow-glow-primary)' }}>
            <Heart size={28} color="white" />
          </div>
          <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-2)' }}>
            {t('auth.loginTitle')}
          </h1>
          <p style={{ color: 'var(--text-tertiary)' }}>
            {t('auth.loginSubtitle')}
          </p>
        </div>

        {/* Form */}
        <div className="glass-card auth-card">
          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div className="input-group">
              <label htmlFor="login-email">{t('auth.emailOrUsername')}</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input
                  id="login-email"
                  type="text"
                  className="input"
                  style={{ paddingLeft: 40 }}
                  placeholder={t('auth.emailOrUsernamePlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div className="input-group">
              <label htmlFor="login-password">{t('auth.password')}</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  style={{ paddingLeft: 40, paddingRight: 44 }}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 8 }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn btn-primary btn-lg btn-full"
              disabled={loading || !email || !password}
              style={{ marginTop: 'var(--space-2)' }}
            >
              {loading ? (
                <>
                  <span className="spinner spinner-sm" />
                  {t('auth.loggingIn')}
                </>
              ) : (
                <>
                  {t('auth.login')}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="auth-footer">
          {t('auth.noAccount')}{' '}
          <Link to="/register">{t('auth.register')}</Link>
        </div>
      </div>
    </div>
  );
}
