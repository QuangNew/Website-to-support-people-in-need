import { useState, type FormEvent } from 'react';
import { Mail, Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { useMapStore } from '../../stores/mapStore';
import { authApi } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

export default function ForgotPasswordModal() {
  const { showAuthModal, setAuthModal } = useMapStore();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (showAuthModal !== 'forgot-password') return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError(t('auth.fillAll'));
      return;
    }

    setIsLoading(true);
    try {
      await authApi.forgotPassword({ email });
      toast.success(t('auth.resetCodeSent'));
      setAuthModal('reset-password');
      setEmail('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('auth.resetError');
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen onClose={() => setAuthModal(null)} size="sm">
      <div className="auth-modal">
        <div className="auth-modal-header">
          <div className="auth-logo">
            <Heart size={28} strokeWidth={2.5} />
          </div>
          <h2>{t('auth.forgotPassword')}</h2>
          <p className="auth-subtitle">{t('auth.forgotPasswordSubtitle')}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error animate-shake">{error}</div>}

          <div className="form-group">
            <label className="form-label">{t('auth.email')}</label>
            <div className="input-with-icon">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                className="form-input"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>
            {isLoading ? <span className="spinner spinner-sm" /> : t('auth.sendResetCode')}
          </button>
        </form>

        <div className="auth-footer">
          <button className="link-btn" onClick={() => setAuthModal('login')}>
            {t('auth.backToLogin')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
