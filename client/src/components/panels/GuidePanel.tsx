import {
  BookOpen,
  UserPlus,
  AlertTriangle,
  Heart,
  Phone,
  Shield,
  Users,
  MapPin,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface GuideSection {
  icon: typeof BookOpen;
  titleKey: string;
  contentKey: string;
}

export default function GuidePanel() {
  const { t } = useLanguage();

  const sections: GuideSection[] = [
    {
      icon: BookOpen,
      titleKey: 'guide.introTitle',
      contentKey: 'guide.introContent',
    },
    {
      icon: UserPlus,
      titleKey: 'guide.registerTitle',
      contentKey: 'guide.registerContent',
    },
    {
      icon: AlertTriangle,
      titleKey: 'guide.sosTitle',
      contentKey: 'guide.sosContent',
    },
    {
      icon: Heart,
      titleKey: 'guide.volunteerTitle',
      contentKey: 'guide.volunteerContent',
    },
    {
      icon: Shield,
      titleKey: 'guide.sponsorTitle',
      contentKey: 'guide.sponsorContent',
    },
    {
      icon: Phone,
      titleKey: 'guide.contactTitle',
      contentKey: 'guide.contactContent',
    },
  ];

  return (
    <div className="panel-content guide-panel">
      <div className="panel-header">
        <h2 className="panel-title">{t('guide.title')}</h2>
      </div>

      <div className="guide-panel-content">
        {sections.map((section, index) => (
          <div key={index} className="guide-section">
            <div className="guide-section-header">
              <section.icon size={20} className="guide-section-icon" />
              <h3 className="guide-section-title">{t(section.titleKey)}</h3>
            </div>
            <p className="guide-section-text">{t(section.contentKey)}</p>
          </div>
        ))}

        <div className="guide-roles">
          <h4 className="guide-roles-title">{t('guide.rolesTitle')}</h4>
          <div className="guide-roles-grid">
            <div className="guide-role-card">
              <Users size={24} className="guide-role-icon guide-role-icon--need" />
              <span className="guide-role-name">{t('guide.roleNeed')}</span>
              <span className="guide-role-desc">{t('guide.roleNeedDesc')}</span>
            </div>
            <div className="guide-role-card">
              <Heart size={24} className="guide-role-icon guide-role-icon--volunteer" />
              <span className="guide-role-name">{t('guide.roleVolunteer')}</span>
              <span className="guide-role-desc">{t('guide.roleVolunteerDesc')}</span>
            </div>
            <div className="guide-role-card">
              <MapPin size={24} className="guide-role-icon guide-role-icon--sponsor" />
              <span className="guide-role-name">{t('guide.roleSponsor')}</span>
              <span className="guide-role-desc">{t('guide.roleSponsorDesc')}</span>
            </div>
          </div>
        </div>

        <div className="guide-status">
          <h4 className="guide-status-title">{t('guide.statusTitle')}</h4>
          <div className="guide-status-list">
            <div className="guide-status-item">
              <span className="guide-status-dot guide-status-dot--active" />
              <span>{t('guide.statusActive')}</span>
            </div>
            <div className="guide-status-item">
              <span className="guide-status-dot guide-status-dot--resolved" />
              <span>{t('guide.statusResolved')}</span>
            </div>
            <div className="guide-status-item">
              <span className="guide-status-dot guide-status-dot--expired" />
              <span>{t('guide.statusExpired')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
