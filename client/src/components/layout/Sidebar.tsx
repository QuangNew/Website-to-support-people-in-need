import {
  ClipboardList,
  Users,
  MessageCircle,
  User,
  Shield,
  Sun,
  Moon,
  Globe,
  LogIn,
  LogOut,
  ChevronRight,
  Menu,
  type LucideIcon,
} from 'lucide-react';
import { useMapStore, type PanelType } from '../../stores/mapStore';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface NavItem {
  id: PanelType;
  icon: LucideIcon;
  labelKey: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'list', icon: ClipboardList, labelKey: 'sidebar.list' },
  { id: 'social', icon: Users, labelKey: 'sidebar.social' },
  { id: 'chat', icon: MessageCircle, labelKey: 'sidebar.chat' },
  { id: 'profile', icon: User, labelKey: 'sidebar.profile' },
];

export default function Sidebar() {
  const { activePanel, setActivePanel, sidebarExpanded, setSidebarExpanded, setAuthModal } = useMapStore();
  const { isAuthenticated, user, logout } = useAuthStore();
  const { toggleTheme, isDark } = useTheme();
  const { t, locale, toggleLocale } = useLanguage();

  const handleNav = (panel: PanelType) => {
    if (panel === 'profile' && !isAuthenticated) {
      setAuthModal('login');
      return;
    }
    setActivePanel(panel);
  };

  const toggleSidebar = () => setSidebarExpanded(!sidebarExpanded);

  return (
    <aside className={`sidebar ${sidebarExpanded ? 'sidebar-expanded' : ''}`}>
      {/* Brand + Hamburger */}
      <div className="sidebar-brand">
        <button className="sidebar-toggle" onClick={toggleSidebar} aria-label="Toggle sidebar">
          <Menu size={20} />
        </button>
        {sidebarExpanded && <span className="sidebar-brand-text">ReliefConnect</span>}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ id, icon: Icon, labelKey }) => (
          <button
            key={id}
            className={`sidebar-nav-item ${activePanel === id ? 'active' : ''}`}
            onClick={() => handleNav(id)}
            title={!sidebarExpanded ? t(labelKey) : undefined}
          >
            <Icon size={20} strokeWidth={activePanel === id ? 2.5 : 2} />
            {sidebarExpanded && <span className="sidebar-nav-label">{t(labelKey)}</span>}
            {sidebarExpanded && activePanel === id && <ChevronRight size={14} className="sidebar-nav-indicator" />}
          </button>
        ))}
      </nav>

      {/* Spacer */}
      <div className="sidebar-spacer" />

      {/* Admin link */}
      {isAuthenticated && user?.role === 'Admin' && (
        <a href="/admin" className="sidebar-nav-item sidebar-admin-link" title={t('sidebar.admin')}>
          <Shield size={20} />
          {sidebarExpanded && <span className="sidebar-nav-label">{t('sidebar.admin')}</span>}
        </a>
      )}

      {/* Actions */}
      <div className="sidebar-actions">
        {/* Theme toggle */}
        <button className="sidebar-action-btn" onClick={toggleTheme} title={isDark ? t('sidebar.lightMode') : t('sidebar.darkMode')}>
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
          {sidebarExpanded && <span className="sidebar-nav-label">{isDark ? t('sidebar.lightMode') : t('sidebar.darkMode')}</span>}
        </button>

        {/* Locale toggle */}
        <button className="sidebar-action-btn" onClick={toggleLocale} title={locale === 'vi' ? 'English' : 'Tiếng Việt'}>
          <Globe size={18} />
          {sidebarExpanded && <span className="sidebar-nav-label">{locale === 'vi' ? 'EN' : 'VI'}</span>}
        </button>

        {/* Auth */}
        {isAuthenticated ? (
          <button className="sidebar-action-btn sidebar-action-danger" onClick={logout} title={t('sidebar.logout')}>
            <LogOut size={18} />
            {sidebarExpanded && <span className="sidebar-nav-label">{t('sidebar.logout')}</span>}
          </button>
        ) : (
          <button className="sidebar-action-btn sidebar-action-primary" onClick={() => setAuthModal('login')} title={t('sidebar.login')}>
            <LogIn size={18} />
            {sidebarExpanded && <span className="sidebar-nav-label">{t('sidebar.login')}</span>}
          </button>
        )}
      </div>
    </aside>
  );
}
