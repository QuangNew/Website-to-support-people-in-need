import { Heart, AlertTriangle, Gift, Map } from 'lucide-react';
import Modal from '../ui/Modal';
import { useMapStore } from '../../stores/mapStore';
import { useLanguage } from '../../contexts/LanguageContext';

export default function WelcomeModal() {
  const { showWelcome, setShowWelcome, setAuthModal } = useMapStore();
  const { t } = useLanguage();

  if (!showWelcome) return null;

  const handleClose = () => setShowWelcome(false);

  return (
    <Modal isOpen onClose={handleClose} size="md" showClose={false}>
      <div className="welcome-modal">
        {/* Icon */}
        <div className="welcome-icon">
          <Heart size={40} strokeWidth={2} />
        </div>

        {/* Title */}
        <h2 className="welcome-title">{t('welcome.title')}</h2>
        <p className="welcome-description">{t('welcome.description')}</p>

        {/* Instructions */}
        <div className="welcome-instructions">
          <div className="welcome-instruction-item">
            <div className="welcome-instruction-icon text-danger">
              <AlertTriangle size={20} />
            </div>
            <p>{t('welcome.needHelp')}</p>
          </div>
          <div className="welcome-instruction-item">
            <div className="welcome-instruction-icon text-success">
              <Gift size={20} />
            </div>
            <p>{t('welcome.wantToHelp')}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="welcome-actions">
          <button className="btn btn-sos" onClick={() => { handleClose(); setAuthModal('login'); }}>
            <AlertTriangle size={16} />
            {t('welcome.needHelpBtn')}
          </button>
          <button className="btn btn-offering" onClick={() => { handleClose(); setAuthModal('login'); }}>
            <Gift size={16} />
            {t('welcome.offerHelp')}
          </button>
        </div>

        <div className="welcome-footer">
          <button className="btn btn-ghost" onClick={handleClose}>
            <Map size={16} />
            {t('welcome.viewMap')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
