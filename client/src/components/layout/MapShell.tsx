import { useEffect } from 'react';
import { X } from 'lucide-react';
import Sidebar from './Sidebar';
import FilterBar from './FilterBar';
import MapView from '../map/MapView';
import PingDetailPanel from '../map/PingDetailPanel';
import SOSCreationFlow from '../map/SOSCreationFlow';
import ListPanel from '../panels/ListPanel';
import SocialPanel from '../panels/SocialPanel';
import ChatPanel from '../panels/ChatPanel';
import ProfilePanel from '../panels/ProfilePanel';
import VerificationPanel from '../panels/VerificationPanel';
import GuidePanel from '../panels/GuidePanel';
import PersonInNeedPanel from '../panels/PersonInNeedPanel';
import VolunteerPanel from '../panels/VolunteerPanel';
import SponsorPanel from '../panels/SponsorPanel';
import MessagingPanel from '../panels/MessagingPanel';
import LoginModal from '../auth/LoginModal';
import RegisterModal from '../auth/RegisterModal';
import ForgotPasswordModal from '../auth/ForgotPasswordModal';
import ResetPasswordModal from '../auth/ResetPasswordModal';
import WelcomeModal from '../auth/WelcomeModal';
import { useMapStore, type PanelType } from '../../stores/mapStore';
import { useAuthStore } from '../../stores/authStore';
import { useMessageStore } from '../../stores/messageStore';
import { startDirectMessageConnection, stopDirectMessageConnection } from '../../services/directMessageSignalR';

const PANEL_COMPONENTS: Record<NonNullable<PanelType>, React.FC> = {
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
  const { activePanel, setActivePanel, sidebarExpanded, fetchPings, fetchZones } = useMapStore();
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

      {/* Floating filter bar */}
      <FilterBar />

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
            <PanelComponent />
          </div>
        </div>
      )}

      {/* Ping detail panel */}
      <PingDetailPanel />

      {/* SOS creation flow (floating button + panels) */}
      <SOSCreationFlow />

      {/* Auth modals */}
      <LoginModal />
      <RegisterModal />
      <ForgotPasswordModal />
      <ResetPasswordModal />
      <WelcomeModal />
    </div>
  );
}
