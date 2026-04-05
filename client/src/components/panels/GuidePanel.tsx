import { useState } from 'react';
import {
  BookOpen,
  UserPlus,
  AlertTriangle,
  Heart,
  Phone,
  Shield,
  Users,
  Map,
  Filter,
  MessageCircle,
  UserCheck,
  HandHeart,
  type LucideIcon,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

type TabId = 'overview' | 'sos' | 'roles' | 'community' | 'contact';

interface GuideTab {
  id: TabId;
  labelKey: string;
  icon: LucideIcon;
}

interface GuideSectionItem {
  icon: LucideIcon;
  titleKey: string;
  contentKey: string;
}

const TABS: GuideTab[] = [
  { id: 'overview', labelKey: 'guide.tabOverview', icon: BookOpen },
  { id: 'sos', labelKey: 'guide.tabSOS', icon: AlertTriangle },
  { id: 'roles', labelKey: 'guide.tabRoles', icon: Users },
  { id: 'community', labelKey: 'guide.tabCommunity', icon: MessageCircle },
  { id: 'contact', labelKey: 'guide.tabContact', icon: Phone },
];

const TAB_SECTIONS: Record<TabId, GuideSectionItem[]> = {
  overview: [
    { icon: BookOpen, titleKey: 'guide.introTitle', contentKey: 'guide.introContent' },
    { icon: UserPlus, titleKey: 'guide.registerTitle', contentKey: 'guide.registerContent' },
    { icon: UserCheck, titleKey: 'guide.verifyTitle', contentKey: 'guide.verifyContent' },
  ],
  sos: [
    { icon: AlertTriangle, titleKey: 'guide.sosTitle', contentKey: 'guide.sosContent' },
    { icon: Map, titleKey: 'guide.mapTitle', contentKey: 'guide.mapContent' },
    { icon: Filter, titleKey: 'guide.filterTitle', contentKey: 'guide.filterContent' },
  ],
  roles: [],
  community: [
    { icon: Users, titleKey: 'guide.communityTitle', contentKey: 'guide.communityContent' },
    { icon: MessageCircle, titleKey: 'guide.chatbotTitle', contentKey: 'guide.chatbotContent' },
  ],
  contact: [
    { icon: Phone, titleKey: 'guide.contactTitle', contentKey: 'guide.contactContent' },
  ],
};

export default function GuidePanel() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const sections = TAB_SECTIONS[activeTab];

  return (
    <div className="panel-content guide-panel">
      <div className="panel-header">
        <h2 className="panel-title">{t('guide.title')}</h2>
      </div>

      {/* Bookmark tabs */}
      <div className="guide-tabs">
        {TABS.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`guide-tab ${activeTab === tab.id ? 'guide-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <TabIcon size={14} />
              <span>{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="guide-panel-content">
        {/* Regular sections */}
        {sections.map((section, index) => (
          <div key={index} className="guide-section">
            <div className="guide-section-header">
              <section.icon size={20} className="guide-section-icon" />
              <h3 className="guide-section-title">{t(section.titleKey)}</h3>
            </div>
            <p className="guide-section-text">{t(section.contentKey)}</p>
          </div>
        ))}

        {/* Roles tab: special layout */}
        {activeTab === 'roles' && (
          <>
            <div className="guide-roles">
              <h4 className="guide-roles-title">{t('guide.rolesTitle')}</h4>
              <div className="guide-roles-grid">
                <div className="guide-role-card">
                  <Heart size={24} className="guide-role-icon guide-role-icon--need" />
                  <div className="guide-role-info">
                    <span className="guide-role-name">{t('guide.roleNeed')}</span>
                    <span className="guide-role-desc-always">{t('guide.roleNeedDesc')}</span>
                  </div>
                </div>
                <div className="guide-role-card">
                  <HandHeart size={24} className="guide-role-icon guide-role-icon--volunteer" />
                  <div className="guide-role-info">
                    <span className="guide-role-name">{t('guide.roleVolunteer')}</span>
                    <span className="guide-role-desc-always">{t('guide.roleVolunteerDesc')}</span>
                  </div>
                </div>
                <div className="guide-role-card">
                  <Shield size={24} className="guide-role-icon guide-role-icon--sponsor" />
                  <div className="guide-role-info">
                    <span className="guide-role-name">{t('guide.roleSponsor')}</span>
                    <span className="guide-role-desc-always">{t('guide.roleSponsorDesc')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="guide-section">
              <div className="guide-section-header">
                <Heart size={20} className="guide-section-icon" />
                <h3 className="guide-section-title">{t('guide.volunteerTitle')}</h3>
              </div>
              <p className="guide-section-text">{t('guide.volunteerContent')}</p>
            </div>
            <div className="guide-section">
              <div className="guide-section-header">
                <Shield size={20} className="guide-section-icon" />
                <h3 className="guide-section-title">{t('guide.sponsorTitle')}</h3>
              </div>
              <p className="guide-section-text">{t('guide.sponsorContent')}</p>
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
          </>
        )}

        {/* Contact tab: emergency hotlines */}
        {activeTab === 'contact' && (
          <div className="guide-emergency">
            <h4 className="guide-roles-title">{t('guide.emergencyTitle')}</h4>
            <div className="guide-emergency-list">
              <div className="guide-emergency-item guide-emergency-item--police">
                <Phone size={16} />
                <span>{t('guide.emergencyPolice')}</span>
              </div>
              <div className="guide-emergency-item guide-emergency-item--fire">
                <Phone size={16} />
                <span>{t('guide.emergencyFire')}</span>
              </div>
              <div className="guide-emergency-item guide-emergency-item--medical">
                <Phone size={16} />
                <span>{t('guide.emergencyMedical')}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
