import {
  ClipboardList,
  Users,
  MessageCircle,
  Mail,
  User,
  Shield,
  UserCheck,
  Sun,
  Moon,
  Globe,
  LogIn,
  LogOut,
  ChevronRight,
  Menu,
  BookOpen,
  Heart,
  HeartPulse,
  ClipboardCheck,
  HandHeart,
  type LucideIcon,
} from 'lucide-react';
import { useMapStore, type PanelType } from '../../stores/mapStore';
import { useAuthStore } from '../../stores/authStore';
import { useMessageStore } from '../../stores/messageStore';
import { useTheme } from '../../contexts/ThemeContext';
import { getNextLocaleLabel, useLanguage } from '../../contexts/LanguageContext';


interface NavItem {
  id: PanelType | 'theme' | 'locale' | 'login' | 'logout' | 'admin' | 'guide' | 'donate';
  icon: LucideIcon;
  labelKey: string;
  action?: () => void;
}

export default function Sidebar() {
  const { activePanel, setActivePanel, sidebarExpanded, setSidebarExpanded, setAuthModal } = useMapStore();
  const { isAuthenticated, user, logout } = useAuthStore();
  const { totalUnread } = useMessageStore();
  const { toggleTheme, isDark } = useTheme();
  const { t, locale, toggleLocale } = useLanguage();

  const handleNav = (panel: PanelType) => {
    if ((panel === 'profile' || panel === 'verify' || panel === 'my-sos' || panel === 'volunteer' || panel === 'sponsor' || panel === 'messages') && !isAuthenticated) {
      setAuthModal('login');
      return;
    }
    setActivePanel(panel);
  };

  const toggleSidebar = () => setSidebarExpanded(!sidebarExpanded);

  // ─── Top section: main nav ───
  const topItems: NavItem[] = [
    { id: 'list', icon: ClipboardList, labelKey: 'sidebar.list' },
    { id: 'social', icon: Users, labelKey: 'sidebar.social' },
    { id: 'messages', icon: Mail, labelKey: 'sidebar.messages' },
    { id: 'chat', icon: MessageCircle, labelKey: 'sidebar.chat' },
    { id: 'profile', icon: User, labelKey: 'sidebar.profile' },
  ];

  // ─── Mid-bottom section: verify, admin, guide ───
  const midBottomItems: NavItem[] = [
    { id: 'verify', icon: UserCheck, labelKey: 'sidebar.verify' },
    { id: 'guide', icon: BookOpen, labelKey: 'sidebar.guide' },
    { id: 'donate', icon: Heart, labelKey: 'sidebar.donate' },
  ];

  // ─── Role-specific nav items (only for verified users) ───
  if (isAuthenticated && user?.verificationStatus === 'Approved') {
    if (user.role === 'PersonInNeed') {
      midBottomItems.unshift({ id: 'my-sos', icon: HeartPulse, labelKey: 'sidebar.mySos' });
    } else if (user.role === 'Volunteer') {
      midBottomItems.unshift({ id: 'volunteer', icon: ClipboardCheck, labelKey: 'sidebar.volunteerTasks' });
    } else if (user.role === 'Sponsor') {
      midBottomItems.unshift({ id: 'sponsor', icon: HandHeart, labelKey: 'sidebar.sponsorSupport' });
    }
  }

  if (isAuthenticated && user?.role === 'Admin') {
    midBottomItems.push({ id: 'admin', icon: Shield, labelKey: 'sidebar.admin' });
  }

  const renderNavButton = (item: NavItem, isActive: boolean = false) => {
    const iconSize = 20;

    if (item.id === 'admin' || item.id === 'donate') {
      return (
        <a
          key={item.id}
          href={item.id === 'donate' ? '/donate' : '/admin'}
          className="sidebar-nav-item"
          title={!sidebarExpanded ? t(item.labelKey) : undefined}
        >
          <item.icon size={iconSize} />
          {sidebarExpanded && <span className="sidebar-nav-label">{t(item.labelKey)}</span>}
        </a>
      );
    }

    // Panel items (list, social, chat, profile, verify, guide, admin)
    if (['list', 'social', 'chat', 'profile', 'verify', 'guide', 'admin', 'my-sos', 'volunteer', 'sponsor', 'messages'].includes(item.id as string)) {
      const panelId = item.id as PanelType;
      return (
        <button
          key={item.id}
          className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
          onClick={() => handleNav(panelId)}
          title={!sidebarExpanded ? t(item.labelKey) : undefined}
          style={{ position: 'relative' }}
        >
          <item.icon size={iconSize} strokeWidth={isActive ? 2.5 : 2} />
          {sidebarExpanded && <span className="sidebar-nav-label">{t(item.labelKey)}</span>}
          {sidebarExpanded && isActive && <ChevronRight size={14} className="sidebar-nav-indicator" />}
          {item.id === 'messages' && totalUnread > 0 && !sidebarExpanded && (
            <span className="sidebar-msg-badge">{totalUnread > 99 ? '99+' : totalUnread}</span>
          )}
          {item.id === 'messages' && totalUnread > 0 && sidebarExpanded && (
            <span className="messaging-unread-badge" style={{ marginLeft: 'auto' }}>{totalUnread > 99 ? '99+' : totalUnread}</span>
          )}
        </button>
      );
    }

    return null;
  };

  return (
    <aside className={`sidebar ${sidebarExpanded ? 'sidebar-expanded' : ''}`}>
      {/* Brand + Hamburger */}
      <div className="sidebar-brand">
        <button className="sidebar-toggle" onClick={toggleSidebar} aria-label="Toggle sidebar">
          <Menu size={20} />
        </button>
        {sidebarExpanded && <span className="sidebar-brand-text">{t('sidebar.brandName')}</span>}
      </div>

      {/* ═══ Top: Main navigation ═══ */}
      <nav className="sidebar-nav">
        {topItems.map((item) => renderNavButton(item, activePanel === item.id))}

        {/* Divider */}
        <div className="sidebar-divider" />

        {/* Mid-bottom: Verify, Admin */}
        {midBottomItems.map((item) => renderNavButton(item, activePanel === item.id))}
      </nav>

      {/* Spacer pushes bottom items down */}
      <div className="sidebar-spacer" />



      {/* ═══ Bottom: Theme, Language, Login/Logout ═══ */}
      <div className="sidebar-bottom">
        {/* Theme toggle */}
        <button
          className="sidebar-nav-item"
          onClick={toggleTheme}
          title={!sidebarExpanded ? (isDark ? t('sidebar.lightMode') : t('sidebar.darkMode')) : undefined}
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
          {sidebarExpanded && (
            <span className="sidebar-nav-label">{isDark ? t('sidebar.lightMode') : t('sidebar.darkMode')}</span>
          )}
        </button>

        {/* Locale toggle */}
        <button
          className="sidebar-nav-item"
          onClick={toggleLocale}
          title={!sidebarExpanded ? getNextLocaleLabel(locale) : undefined}
        >
          <Globe size={20} />
          {sidebarExpanded && (
            <span className="sidebar-nav-label">{getNextLocaleLabel(locale)}</span>
          )}
        </button>

        {/* Auth */}
        {isAuthenticated ? (
          <button
            className="sidebar-nav-item sidebar-nav-danger"
            onClick={() => { void logout(); }}
            title={!sidebarExpanded ? t('sidebar.logout') : undefined}
          >
            <LogOut size={20} />
            {sidebarExpanded && <span className="sidebar-nav-label">{t('sidebar.logout')}</span>}
          </button>
        ) : (
          <button
            className="sidebar-nav-item sidebar-nav-primary"
            onClick={() => setAuthModal('login')}
            title={!sidebarExpanded ? t('sidebar.login') : undefined}
          >
            <LogIn size={20} />
            {sidebarExpanded && <span className="sidebar-nav-label">{t('sidebar.login')}</span>}
          </button>
        )}
      </div>
    </aside>
  );
}
