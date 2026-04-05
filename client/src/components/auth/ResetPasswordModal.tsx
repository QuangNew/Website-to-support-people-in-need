import { useState, type FormEvent } from 'react';
import { Lock, Heart, Eye, EyeOff, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { useMapStore } from '../../stores/mapStore';
import { authApi } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

export default function ResetPasswordModal() {
  const { showAuthModal, setAuthModal } = useMapStore();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (showAuthModal !== 'reset-password') return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !token || !newPassword) {
      setError(t('auth.fillAll'));
      return;
    }

    setIsLoading(true);
    try {
      await authApi.resetPassword({ email, token, newPassword });
      toast.success(t('auth.resetSuccess'));
      setAuthModal('login');
      setEmail('');
      setToken('');
      setNewPassword('');
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
          <h2>{t('auth.resetPassword')}</h2>
          <p className="auth-subtitle">{t('auth.resetPasswordSubtitle')}</p>
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

          <div className="form-group">
            <label className="form-label">{t('auth.resetCode')}</label>
            <input
              type="text"
              className="form-input"
              placeholder="123456"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              maxLength={6}
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('auth.newPassword')}</label>
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder={t('auth.passwordPlaceholder')}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
            {isLoading ? <span className="spinner spinner-sm" /> : t('auth.resetPassword')}
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
