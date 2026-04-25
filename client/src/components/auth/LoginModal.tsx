import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Mail, Lock, Heart, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { useMapStore } from '../../stores/mapStore';
import { useAuthStore } from '../../stores/authStore';
import { useLanguage } from '../../contexts/LanguageContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function LoginModal() {
  const { showAuthModal, setAuthModal } = useMapStore();
  const { login, googleLogin, isLoading } = useAuthStore();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Initialize Google Sign-In button
  useEffect(() => {
    if (showAuthModal !== 'login' || !GOOGLE_CLIENT_ID) return;

    const initGoogle = () => {
      if (!(window as any).google?.accounts?.id) return;
      (window as any).google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
      });
      if (googleBtnRef.current) {
        // Google Identity Services expects `width` as an integer (pixels), NOT a string like '100%'.
        // Passing a string causes the SDK to fallback to a small default (~200px).
        // Compute the container's actual pixel width for a full-width button.
        const containerWidth = googleBtnRef.current.offsetWidth || 340;
        (window as any).google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: Math.min(containerWidth, 400),
          text: 'signin_with',
          shape: 'pill',
        });
      }
    };

    // Google script may already be loaded
    if ((window as any).google?.accounts?.id) {
      // Slight delay to ensure modal is rendered and container has its final width
      setTimeout(initGoogle, 50);
    } else {
      // Load the Google Identity Services script
      const existing = document.getElementById('google-gsi');
      if (!existing) {
        const script = document.createElement('script');
        script.id = 'google-gsi';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = initGoogle;
        document.head.appendChild(script);
      } else {
        existing.addEventListener('load', initGoogle);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAuthModal]);

  if (showAuthModal !== 'login') return null;

  const handleGoogleResponse = async (response: { credential: string }) => {
    setError('');
    try {
      await googleLogin(response.credential);
      toast.success(t('auth.loginSuccess'));
      setAuthModal(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('auth.loginError');
      setError(msg);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError(t('auth.fillAll'));
      return;
    }

    try {
      await login(email, password);
      toast.success(t('auth.loginSuccess'));
      setAuthModal(null);
      setEmail('');
      setPassword('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('auth.loginError');
      setError(msg);
    }
  };

  return (
    <Modal isOpen onClose={() => setAuthModal(null)} size="sm">
      <div className="auth-modal">
        {/* Header */}
        <div className="auth-modal-header">
          <div className="auth-logo">
            <Heart size={28} strokeWidth={2.5} />
          </div>
          <h2>{t('auth.loginTitle')}</h2>
          <p className="auth-subtitle">{t('auth.loginSubtitle')}</p>
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
            <label className="form-label">{t('auth.emailOrUsername')}</label>
            <div className="input-with-icon">
              <Mail size={16} className="input-icon" />
              <input
                type="text"
                className="form-input"
                placeholder={t('auth.emailOrUsernamePlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

          <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>
            {isLoading ? <span className="spinner spinner-sm" /> : t('auth.login')}
          </button>

          <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            <button className="link-btn" onClick={() => setAuthModal('forgot-password')}>
              {t('auth.forgotPassword')}?
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="auth-footer">
          <span>{t('auth.noAccount')}</span>
          <button className="link-btn" onClick={() => setAuthModal('register')}>
            {t('auth.registerNow')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
