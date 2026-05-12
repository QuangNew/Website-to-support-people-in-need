import { lazy, Suspense, useEffect, type ComponentType, type LazyExoticComponent } from 'react';
import { X } from 'lucide-react';
import Sidebar from './Sidebar';
import FilterBar from './FilterBar';
import MobileTopBar from './MobileTopBar';
import MobileNav from './MobileNav';
import MapView from '../map/MapView';
import PingDetailPanel from '../map/PingDetailPanel';
import SOSCreationFlow from '../map/SOSCreationFlow';
import { useMapStore, type PanelType } from '../../stores/mapStore';
import { useAuthStore } from '../../stores/authStore';
import { useMessageStore } from '../../stores/messageStore';
import { startDirectMessageConnection, stopDirectMessageConnection } from '../../services/directMessageSignalR';

const ListPanel = lazy(() => import('../panels/ListPanel'));
const SocialPanel = lazy(() => import('../panels/SocialPanel'));
const ChatPanel = lazy(() => import('../panels/ChatPanel'));
const ProfilePanel = lazy(() => import('../panels/ProfilePanel'));
const VerificationPanel = lazy(() => import('../panels/VerificationPanel'));
const GuidePanel = lazy(() => import('../panels/GuidePanel'));
const PersonInNeedPanel = lazy(() => import('../panels/PersonInNeedPanel'));
const VolunteerPanel = lazy(() => import('../panels/VolunteerPanel'));
const SponsorPanel = lazy(() => import('../panels/SponsorPanel'));
const MessagingPanel = lazy(() => import('../panels/MessagingPanel'));

const LoginModal = lazy(() => import('../auth/LoginModal'));
const RegisterModal = lazy(() => import('../auth/RegisterModal'));
const ForgotPasswordModal = lazy(() => import('../auth/ForgotPasswordModal'));
const ResetPasswordModal = lazy(() => import('../auth/ResetPasswordModal'));
const WelcomeModal = lazy(() => import('../auth/WelcomeModal'));

const PANEL_COMPONENTS: Record<NonNullable<PanelType>, LazyExoticComponent<ComponentType>> = {
  list: ListPanel,
  social: SocialPanel,
  chat: ChatPanel,
  profile: ProfilePanel,
  verify: VerificationPanel,
  guide: GuidePanel,
  'my-sos': PersonInNeedPanel,
  volunteer: VolunteerPanel,
  sponsor: SponsorPanel,
  messages: MessagingPanel,
};

export default function MapShell() {
  const {
    activePanel,
    setActivePanel,
    sidebarExpanded,
    showAuthModal,
    showWelcome,
    fetchPings,
    fetchZones,
  } = useMapStore();
  const { isAuthenticated } = useAuthStore();
  const fetchUnreadCount = useMessageStore((s) => s.fetchUnreadCount);

  // Fetch all recent pings + zones on mount
  // Initial fetchPings() loads 500 most recent (no bounds) for full overview;
  // MapView then uses fetchPingsInBounds() on pan/zoom for spatial filtering.
  useEffect(() => {
    fetchPings();
    fetchZones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connect DirectMessage SignalR + fetch unread count when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      startDirectMessageConnection();
      fetchUnreadCount();
    } else {
      stopDirectMessageConnection();
    }
    return () => stopDirectMessageConnection();
  }, [isAuthenticated, fetchUnreadCount]);

  const PanelComponent = activePanel ? PANEL_COMPONENTS[activePanel] : null;

  return (
    <div className={`map-shell ${sidebarExpanded ? 'sidebar-is-expanded' : ''}`}>
      {/* Full-screen map background */}
      <div className="map-container">
        <MapView />
      </div>

      {/* Sidebar navigation */}
      <Sidebar />

      {/* Floating filter bar (desktop) */}
      <FilterBar />

      {/* Mobile top bar — search + count chips (mobile only) */}
      <MobileTopBar />

      {/* Mobile bottom navigation (mobile only) */}
      <MobileNav />

      {/* Side panel */}
      {PanelComponent && (
        <div className="panel-container animate-slide-in-left">
          <div className="panel-wrapper">
            <button
              className="panel-close-btn"
              onClick={() => setActivePanel(null)}
              aria-label="Close panel"
            >
              <X size={16} />
            </button>
            <Suspense fallback={<div className="panel-lazy-fallback"><div className="spinner" /></div>}>
              <PanelComponent />
            </Suspense>
          </div>
        </div>
      )}

      {/* Ping detail panel */}
      <PingDetailPanel />

      {/* SOS creation flow (floating button + panels) */}
      <SOSCreationFlow />

      {/* Auth modals */}
      <Suspense fallback={null}>
        {showAuthModal === 'login' && <LoginModal />}
        {showAuthModal === 'register' && <RegisterModal />}
        {showAuthModal === 'forgot-password' && <ForgotPasswordModal />}
        {showAuthModal === 'reset-password' && <ResetPasswordModal />}
        {showWelcome && <WelcomeModal />}
      </Suspense>
    </div>
  );
}
