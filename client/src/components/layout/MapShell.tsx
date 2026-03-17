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
import LoginModal from '../auth/LoginModal';
import RegisterModal from '../auth/RegisterModal';
import ForgotPasswordModal from '../auth/ForgotPasswordModal';
import ResetPasswordModal from '../auth/ResetPasswordModal';
import WelcomeModal from '../auth/WelcomeModal';
import { useMapStore, type PanelType } from '../../stores/mapStore';
import { useAuthStore } from '../../stores/authStore';

const PANEL_COMPONENTS: Record<NonNullable<PanelType>, React.FC> = {
  list: ListPanel,
  social: SocialPanel,
  chat: ChatPanel,
  profile: ProfilePanel,
};

export default function MapShell() {
  const { activePanel, setActivePanel, sidebarExpanded, fetchPings, fetchZones } = useMapStore();
  const { loadUser, isAuthenticated, token } = useAuthStore();

  // Load user on mount if token exists
  useEffect(() => {
    if (token && !isAuthenticated) {
      loadUser().catch(() => {});
    }
  }, [token, isAuthenticated, loadUser]);

  // Fetch real pings + zones from backend (falls back to mock data)
  useEffect(() => {
    fetchPings();
    fetchZones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
