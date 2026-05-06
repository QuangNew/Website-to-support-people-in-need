import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Mail, Lock, Heart, User, AtSign, Eye, EyeOff, ShieldCheck, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { useMapStore } from '../../stores/mapStore';
import { useAuthStore } from '../../stores/authStore';
import { useLanguage } from '../../contexts/LanguageContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

type GoogleCredentialResponse = { credential: string };

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
  }) => void;
  renderButton: (parent: HTMLElement, options: {
    theme: 'outline';
    size: 'large';
    width: number;
    text: 'signin_with' | 'signup_with';
    shape: 'pill';
  }) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
  }
}

type Step = 'form' | 'verify';

export default function RegisterModal() {
  const { showAuthModal, setAuthModal } = useMapStore();
  const { register, googleLogin, verifyEmail, resendCode, isLoading, user } = useAuthStore();
  const { t } = useLanguage();

  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Initialize Google Sign-In button
  useEffect(() => {
    if (showAuthModal !== 'register' || !GOOGLE_CLIENT_ID) return;

    let frameOne = 0;
    let frameTwo = 0;
    let lastWidth = 0;
    let resizeObserver: ResizeObserver | null = null;
    let loadHandler: (() => void) | null = null;

    const renderGoogleButton = () => {
      const google = window.google?.accounts?.id;
      const container = googleBtnRef.current;
      if (!google || !container) return;

      const containerWidth = Math.round(container.getBoundingClientRect().width);
      if (!containerWidth) return;
      if (containerWidth === lastWidth && container.childElementCount > 0) return;

      lastWidth = containerWidth;
      container.innerHTML = '';

      google.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
      });
      google.renderButton(container, {
        theme: 'outline',
        size: 'large',
        width: Math.min(containerWidth, 400),
        text: 'signup_with',
        shape: 'pill',
      });
    };

    const scheduleRender = () => {
      cancelAnimationFrame(frameOne);
      cancelAnimationFrame(frameTwo);
      frameOne = requestAnimationFrame(() => {
        frameTwo = requestAnimationFrame(renderGoogleButton);
      });
    };

    resizeObserver = new ResizeObserver(([entry]) => {
      const containerWidth = Math.round(entry.contentRect.width);
      if (!containerWidth || (containerWidth === lastWidth && googleBtnRef.current?.childElementCount)) return;
      scheduleRender();
    });

    if (googleBtnRef.current) {
      resizeObserver.observe(googleBtnRef.current);
    }

    if (window.google?.accounts?.id) {
      scheduleRender();
    } else {
      const existing = document.getElementById('google-gsi');
      loadHandler = () => {
        lastWidth = 0;
        scheduleRender();
      };

      if (!existing) {
        const script = document.createElement('script');
        script.id = 'google-gsi';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.addEventListener('load', loadHandler, { once: true });
        document.head.appendChild(script);
      } else {
        existing.addEventListener('load', loadHandler, { once: true });
      }
    }

    return () => {
      cancelAnimationFrame(frameOne);
      cancelAnimationFrame(frameTwo);
      resizeObserver?.disconnect();
      if (loadHandler) {
        document.getElementById('google-gsi')?.removeEventListener('load', loadHandler);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAuthModal]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Reset when modal closes
  useEffect(() => {
    if (showAuthModal !== 'register') {
      setStep('form');
      setOtpCode('');
      setError('');
    }
  }, [showAuthModal]);

  if (showAuthModal !== 'register') return null;

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleGoogleResponse = async (response: GoogleCredentialResponse) => {
    setError('');
    try {
      await googleLogin(response.credential);
      toast.success(t('auth.registerSuccess'));
      setAuthModal(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('auth.registerError');
      setError(msg);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.fullName || !form.username || !form.email || !form.password) {
      setError(t('auth.fillAll'));
      return;
    }
    if (form.password.length < 8) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    try {
      await register({ fullName: form.fullName, username: form.username, email: form.email, password: form.password });
      toast.success(t('auth.codeSent'));
      setStep('verify');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('auth.registerError');
      setError(msg);
    }
  };

  const handleVerifyEmail = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (otpCode.length !== 6) {
      setError(t('auth.enter6Digits'));
      return;
    }

    try {
      await verifyEmail(otpCode);
      toast.success(t('auth.emailVerified'));
      setAuthModal(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('auth.verifyFailed');
      setError(msg);
    }
  };

  const handleResend = async () => {
    try {
      await resendCode();
      setResendCooldown(60);
      toast.success(t('auth.codeResent'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('auth.resendFailed');
      setError(msg);
    }
  };

  // ─── Email Verification Step ───
  if (step === 'verify') {
    return (
      <Modal isOpen onClose={() => setAuthModal(null)} size="sm">
        <div className="auth-modal">
          <div className="auth-modal-header">
            <div className="auth-logo" style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'var(--success-500)' }}>
              <ShieldCheck size={28} strokeWidth={2.5} />
            </div>
            <h2>{t('auth.verifyEmailTitle')}</h2>
            <p className="auth-subtitle">
              {t('auth.verifyEmailSubtitle')} {user?.email || form.email}
            </p>
          </div>

          <form className="auth-form" onSubmit={handleVerifyEmail}>
            {error && (
              <div className="auth-error animate-shake">{error}</div>
            )}

            <div className="form-group">
              <input
                type="text"
                className="form-input otp-input"
                placeholder="000000"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
                style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem', fontWeight: 700 }}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={isLoading || otpCode.length !== 6}>
              {isLoading ? <span className="spinner spinner-sm" /> : t('auth.verifyBtn')}
            </button>

            <div className="auth-footer" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className="link-btn"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={14} />
                {resendCooldown > 0
                  ? `${t('auth.resendIn')} ${resendCooldown}s`
                  : t('auth.resendCode')}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    );
  }

  // ─── Registration Form Step ───
  return (
    <Modal isOpen onClose={() => setAuthModal(null)} size="sm">
      <div className="auth-modal">
        {/* Header */}
        <div className="auth-modal-header">
          <div className="auth-logo">
            <Heart size={28} strokeWidth={2.5} />
          </div>
          <h2>{t('auth.registerTitle')}</h2>
          <p className="auth-subtitle">{t('auth.registerSubtitle')}</p>
        </div>

        {/* Google Sign-In */}
        {GOOGLE_CLIENT_ID && (
          <>
            <div ref={googleBtnRef} className="google-signin-btn" />
            <div className="auth-divider">
              <span>{t('auth.orDivider')}</span>
            </div>
          </>
        )}

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && (
            <div className="auth-error animate-shake">
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{t('auth.fullName')}</label>
            <div className="input-with-icon">
              <User size={16} className="input-icon" />
              <input
                type="text"
                className="form-input"
                placeholder={t('auth.fullNamePlaceholder')}
                value={form.fullName}
                onChange={(e) => update('fullName', e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('auth.username')}</label>
            <div className="input-with-icon">
              <AtSign size={16} className="input-icon" />
              <input
                type="text"
                className="form-input"
                placeholder={t('auth.usernamePlaceholder')}
                value={form.username}
                onChange={(e) => update('username', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('auth.email')}</label>
            <div className="input-with-icon">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                className="form-input"
                placeholder={t('auth.emailPlaceholder')}
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('auth.password')}</label>
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder={t('auth.passwordPlaceholder')}
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
              />
              <button
                type="button"
                className="input-action"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('auth.confirmPassword')}</label>
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder={t('auth.confirmPasswordPlaceholder')}
                value={form.confirmPassword}
                onChange={(e) => update('confirmPassword', e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>
            {isLoading ? <span className="spinner spinner-sm" /> : t('auth.register')}
          </button>
        </form>

        {/* Footer */}
        <div className="auth-footer">
          <span>{t('auth.hasAccount')}</span>
          <button className="link-btn" onClick={() => setAuthModal('login')}>
            {t('auth.loginNow')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
