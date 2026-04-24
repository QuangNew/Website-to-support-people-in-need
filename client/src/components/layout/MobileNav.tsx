import { useRef, useEffect } from 'react';
import {
  ClipboardList, Users, Mail, MessageCircle, User,
  Shield, UserCheck, BookOpen, HeartPulse, ClipboardCheck,
  HandHeart, Sun, Moon, Globe, LogIn, LogOut, AlertCircle, Heart,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMapStore, type PanelType } from '../../stores/mapStore';
import { useAuthStore } from '../../stores/authStore';
import { useMessageStore } from '../../stores/messageStore';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

export default function MobileNav() {
  const { activePanel, setActivePanel, triggerSOS, setAuthModal } = useMapStore();
  const { isAuthenticated, user, logout } = useAuthStore();
  const { totalUnread } = useMessageStore();
  const { toggleTheme, isDark } = useTheme();
  const { t, locale, toggleLocale } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Repeating nudge: scroll right a little then back so users know it's swipeable.
  // Stops permanently after the user manually scrolls.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let stopped = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const nudge = () => {
      if (stopped || !el) return;
      el.scrollTo({ left: 60, behavior: 'smooth' });
      setTimeout(() => {
        if (!stopped && el) el.scrollTo({ left: 0, behavior: 'smooth' });
      }, 550);
    };

    const onUserScroll = () => {
      stopped = true;
      if (intervalId !== null) clearInterval(intervalId);
    };
    el.addEventListener('scroll', onUserScroll, { once: true, passive: true });

    const firstTimeout = setTimeout(() => {
      nudge();
      intervalId = setInterval(nudge, 3200);
    }, 1400);

    return () => {
      stopped = true;
      clearTimeout(firstTimeout);
      if (intervalId !== null) clearInterval(intervalId);
      el.removeEventListener('scroll', onUserScroll);
    };
  }, []);

  const handleNav = (panel: PanelType) => {
    if (!panel) return;
    if (
      ['profile', 'verify', 'my-sos', 'volunteer', 'sponsor', 'messages'].includes(panel)
      && !isAuthenticated
    ) {
      setAuthModal('login');
      return;
    }
    setActivePanel(panel);
  };

  const isApproved = isAuthenticated && user?.verificationStatus === 'Approved';

  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <div className="mobile-nav-items" ref={scrollRef}>

        {/* Cần giúp — SOS trigger, always red, pinned first */}
        <button type="button" className="mobile-nav-item mobile-nav-item--sos" onClick={() => triggerSOS()}>
          <AlertCircle size={22} strokeWidth={2.5} />
          <span>{t('filter.needHelp')}</span>
        </button>

        {/* Danh sách */}
        <button type="button" className={`mobile-nav-item${activePanel === 'list' ? ' active' : ''}`} onClick={() => handleNav('list')}>
          <ClipboardList size={22} strokeWidth={activePanel === 'list' ? 2.5 : 2} />
          <span>{t('sidebar.list')}</span>
        </button>

        {/* Cộng đồng */}
        <button type="button" className={`mobile-nav-item${activePanel === 'social' ? ' active' : ''}`} onClick={() => handleNav('social')}>
          <Users size={22} strokeWidth={activePanel === 'social' ? 2.5 : 2} />
          <span>{t('sidebar.social')}</span>
        </button>

        {/* Tin nhắn + unread badge */}
        <button type="button" className={`mobile-nav-item${activePanel === 'messages' ? ' active' : ''}`} onClick={() => handleNav('messages')}>
          <span className="mobile-nav-icon-wrap">
            <Mail size={22} strokeWidth={activePanel === 'messages' ? 2.5 : 2} />
            {totalUnread > 0 && (
              <span className="mobile-nav-badge">{totalUnread > 99 ? '99+' : totalUnread}</span>
            )}
          </span>
          <span>{t('sidebar.messages')}</span>
        </button>

        {/* Chatbot AI */}
        <button type="button" className={`mobile-nav-item${activePanel === 'chat' ? ' active' : ''}`} onClick={() => handleNav('chat')}>
          <MessageCircle size={22} strokeWidth={activePanel === 'chat' ? 2.5 : 2} />
          <span>{t('sidebar.chat')}</span>
        </button>

        {/* Hồ sơ */}
        <button type="button" className={`mobile-nav-item${activePanel === 'profile' ? ' active' : ''}`} onClick={() => handleNav('profile')}>
          <User size={22} strokeWidth={activePanel === 'profile' ? 2.5 : 2} />
          <span>{t('sidebar.profile')}</span>
        </button>

        {/* Role-specific: PersonInNeed */}
        {isApproved && user?.role === 'PersonInNeed' && (
          <button type="button" className={`mobile-nav-item${activePanel === 'my-sos' ? ' active' : ''}`} onClick={() => handleNav('my-sos')}>
            <HeartPulse size={22} strokeWidth={activePanel === 'my-sos' ? 2.5 : 2} />
            <span>{t('sidebar.mySos')}</span>
          </button>
        )}

        {/* Role-specific: Volunteer */}
        {isApproved && user?.role === 'Volunteer' && (
          <button type="button" className={`mobile-nav-item${activePanel === 'volunteer' ? ' active' : ''}`} onClick={() => handleNav('volunteer')}>
            <ClipboardCheck size={22} strokeWidth={activePanel === 'volunteer' ? 2.5 : 2} />
            <span>{t('sidebar.volunteerTasks')}</span>
          </button>
        )}

        {/* Role-specific: Sponsor */}
        {isApproved && user?.role === 'Sponsor' && (
          <button type="button" className={`mobile-nav-item${activePanel === 'sponsor' ? ' active' : ''}`} onClick={() => handleNav('sponsor')}>
            <HandHeart size={22} strokeWidth={activePanel === 'sponsor' ? 2.5 : 2} />
            <span>{t('sidebar.sponsorSupport')}</span>
          </button>
        )}

        {/* Xác minh */}
        <button type="button" className={`mobile-nav-item${activePanel === 'verify' ? ' active' : ''}`} onClick={() => handleNav('verify')}>
          <UserCheck size={22} strokeWidth={activePanel === 'verify' ? 2.5 : 2} />
          <span>{t('sidebar.verify')}</span>
        </button>

        {/* Hướng dẫn */}
        <button type="button" className={`mobile-nav-item${activePanel === 'guide' ? ' active' : ''}`} onClick={() => handleNav('guide')}>
          <BookOpen size={22} strokeWidth={activePanel === 'guide' ? 2.5 : 2} />
          <span>{t('sidebar.guide')}</span>
        </button>

        {/* Admin */}
        {isAuthenticated && user?.role === 'Admin' && (
          <a href="/admin" className="mobile-nav-item">
            <Shield size={22} strokeWidth={2} />
            <span>{t('sidebar.admin')}</span>
          </a>
        )}

        {/* Ủng hộ */}
        <button type="button" className="mobile-nav-item mobile-nav-item--donate" onClick={() => navigate('/donate')}>
          <Heart size={22} strokeWidth={2} />
          <span>{t('sidebar.donate')}</span>
        </button>

        {/* Theme toggle */}
        <button type="button" className="mobile-nav-item" onClick={toggleTheme}>
          {isDark
            ? <Sun size={22} strokeWidth={2} />
            : <Moon size={22} strokeWidth={2} />}
          <span>{isDark ? t('sidebar.lightMode') : t('sidebar.darkMode')}</span>
        </button>

        {/* Locale toggle */}
        <button type="button" className="mobile-nav-item" onClick={toggleLocale}>
          <Globe size={22} strokeWidth={2} />
          <span>{locale === 'vi' ? 'English' : 'Tiếng Việt'}</span>
        </button>

        {/* Login / Logout */}
        {isAuthenticated ? (
          <button type="button" className="mobile-nav-item mobile-nav-item--danger" onClick={() => void logout()}>
            <LogOut size={22} strokeWidth={2} />
            <span>{t('sidebar.logout')}</span>
          </button>
        ) : (
          <button type="button" className="mobile-nav-item mobile-nav-item--primary" onClick={() => setAuthModal('login')}>
            <LogIn size={22} strokeWidth={2} />
            <span>{t('sidebar.login')}</span>
          </button>
        )}

      </div>
    </nav>
  );
}
