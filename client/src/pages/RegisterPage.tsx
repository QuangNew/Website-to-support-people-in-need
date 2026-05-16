import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Mail, Lock, User, Eye, EyeOff, ArrowRight, Sun, Moon, Globe, ShieldCheck, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { getNextLocaleLabel, useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

type Step = 'form' | 'verify';

export default function RegisterPage() {
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState({
    email: '',
    username: '',
    fullName: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const register = useAuthStore((s) => s.register);
  const verifyEmail = useAuthStore((s) => s.verifyEmail);
  const resendCode = useAuthStore((s) => s.resendCode);
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { locale, toggleLocale } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

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
      toast.success(t('auth.codeSent'));
      setResendCooldown(60);
      setStep('verify');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('auth.registerError');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      toast.error(t('auth.enter6Digits'));
      return;
    }

    setLoading(true);
    try {
      await verifyEmail(form.email, otpCode);
      toast.success(t('auth.registrationComplete'));
      navigate('/login');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('auth.verifyFailed');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await resendCode(form.email);
      setResendCooldown(60);
      toast.success(t('auth.codeResent'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('auth.resendFailed');
      toast.error(message);
    }
  };

  if (step === 'verify') {
    return (
      <div className="auth-layout">
        <div style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 100 }}>
          <button className="btn btn-ghost btn-icon" onClick={toggleLocale} title={getNextLocaleLabel(locale)}>
            <Globe size={18} />
          </button>
          <button className="btn btn-ghost btn-icon" onClick={toggleTheme} title={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="auth-container animate-fade-in-up">
          <div className="auth-header">
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 'var(--radius-xl)', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--success-500)', marginBottom: 'var(--space-5)' }}>
              <ShieldCheck size={28} />
            </div>
            <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-2)' }}>
              {t('auth.verifyEmailTitle')}
            </h1>
            <p style={{ color: 'var(--text-tertiary)' }}>
              {t('auth.verifyEmailSubtitle')} {form.email}
            </p>
          </div>

          <div className="glass-card auth-card">
            <form onSubmit={handleVerifyEmail}>
              <div className="input-group">
                <input
                  type="text"
                  className="input"
                  placeholder="000000"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  autoFocus
                  style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem', fontWeight: 700 }}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading || otpCode.length !== 6}>
                {loading ? <span className="spinner spinner-sm" /> : t('auth.verifyBtn')}
              </button>
            </form>

            <div className="auth-footer" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className="link-btn"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={14} />
                {resendCooldown > 0 ? `${t('auth.resendIn')} ${resendCooldown}s` : t('auth.resendCode')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-layout">
      {/* Top-right controls */}
      <div style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 100 }}>
        <button className="btn btn-ghost btn-icon" onClick={toggleLocale} title={getNextLocaleLabel(locale)}>
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
