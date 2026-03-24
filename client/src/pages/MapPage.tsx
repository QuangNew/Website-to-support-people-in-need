import MapView from '../components/map/MapView';
import FilterBar from '../components/panels/FilterBar';
import PingDetailPanel from '../components/map/PingDetailPanel';
import SOSCreationFlow from '../components/map/SOSCreationFlow';
import { useMapStore } from '../stores/mapStore';

export default function MapPage() {
    const { selectedPingId } = useMapStore();

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', margin: 'calc(-1 * var(--space-6))', marginTop: 'calc(-1 * var(--space-6))' }}>
            <FilterBar />
            <div style={{ flex: 1, position: 'relative' }}>
                <MapView />
                {selectedPingId && <PingDetailPanel />}
                <SOSCreationFlow />
            </div>
        </div>
    );
}
