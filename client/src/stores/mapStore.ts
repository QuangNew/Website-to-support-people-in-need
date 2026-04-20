import { create } from 'zustand';
import { mapApi, supplyApi } from '../services/api';

export type PingType = 'need_help' | 'offering' | 'received' | 'support_point';
export type PanelType = 'list' | 'social' | 'chat' | 'profile' | 'verify' | 'guide' | 'my-sos' | 'volunteer' | 'sponsor' | null;

export interface PingData {
    id: string;
    lat: number;
    lng: number;
    type: PingType;
    title: string;
    description: string;
    address: string;
    createdAt: string;
    items?: string[];
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    conditionImageUrl?: string;
    status: 'active' | 'resolved' | 'expired';
    isBlinking?: boolean;
    sosCategory?: string;
}

export interface ZoneData {
    id: number;
    name: string;
    riskLevel: number;
    boundary: Array<{ lat: number; lng: number }>;
}

export interface SupplyData {
    id: number;
    name: string;
    quantity: number;
    lat: number;
    lng: number;
}

export interface RouteInfo {
    distanceKm: number;
    durationMin: number;
}

export interface RouteData {
    /** Primary route coordinates */
    coordinates: Array<[number, number]>;
    /** Alternative routes coordinates (up to 2) */
    alternatives: Array<{ coordinates: Array<[number, number]>; info: RouteInfo }>;
    /** Route summary */
    info: RouteInfo;
    /** Currently selected route index (0 = primary, 1 = alt1, 2 = alt2) */
    selectedIndex: number;
    /** Origin point */
    origin: { lat: number; lng: number };
    /** Destination point */
    destination: { lat: number; lng: number };
}

interface MapState {
    center: { lat: number; lng: number };
    zoom: number;
    activeFilters: PingType[];
    activePanel: PanelType;
    selectedPingId: string | null;
    showAuthModal: 'login' | 'register' | 'forgot-password' | 'reset-password' | null;
    resetPasswordEmail: string | null;
    showWelcome: boolean;
    sidebarExpanded: boolean;
    pings: PingData[];
    pingsLoading: boolean;
    zones: ZoneData[];
    showZones: boolean;
    supplyItems: SupplyData[];
    showSupplyPoints: boolean;

    // FlyTo
    flyToTarget: { lat: number; lng: number; zoom?: number } | null;

    // SOS draft marker
    sosDraftLocation: { lat: number; lng: number } | null;
    setSosDraftLocation: (loc: { lat: number; lng: number } | null) => void;

    // Routing
    route: RouteData | null;
    isRouting: boolean;
    routeError: string | null;

    // Actions
    setCenter: (center: { lat: number; lng: number }) => void;
    setFlyTo: (target: { lat: number; lng: number; zoom?: number } | null) => void;
    setZoom: (zoom: number) => void;
    toggleFilter: (filter: PingType) => void;
    setActivePanel: (panel: PanelType) => void;
    selectPing: (id: string | null) => void;
    setAuthModal: (modal: 'login' | 'register' | 'forgot-password' | 'reset-password' | null) => void;
    setResetPasswordEmail: (email: string | null) => void;
    setShowWelcome: (show: boolean) => void;
    setSidebarExpanded: (expanded: boolean) => void;
    setPings: (pings: PingData[]) => void;
    upsertPing: (ping: PingData) => void;
    removePing: (id: string) => void;
    toggleZones: () => void;
    fetchPings: () => Promise<void>;
    fetchPingsInBounds: (bounds: { north: number; south: number; east: number; west: number }) => Promise<void>;
    fetchZones: () => Promise<void>;
    fetchRoute: (destLat: number, destLng: number) => Promise<void>;
    clearRoute: () => void;
    selectRouteIndex: (index: number) => void;
    toggleSupplyPoints: () => void;
    fetchSupplyItems: () => Promise<void>;
}

// Mock data for Vietnam map
export const MOCK_PINGS: PingData[] = [
    {
        id: '1', lat: 16.0544, lng: 108.2022, type: 'need_help',
        title: 'Cần nước sạch gấp', description: 'Khu vực ngập lụt, cần nước uống cho 50 hộ dân',
        address: 'Quận Hải Châu, Đà Nẵng', createdAt: '2026-03-01T08:00:00Z',
        items: ['Nước uống đóng chai', 'Mì gói'], status: 'active'
    },
    {
        id: '2', lat: 10.8231, lng: 106.6297, type: 'offering',
        title: 'Gạo + mì gói (100 phần)', description: 'Có 100 phần gạo và mì gói muốn chia sẻ',
        address: 'Quận 1, TP.HCM', createdAt: '2026-03-01T09:00:00Z',
        items: ['Gạo', 'Mì Gói', 'Đồ hộp'], contactPhone: '0901234567', status: 'active'
    },
    {
        id: '3', lat: 21.0285, lng: 105.8542, type: 'support_point',
        title: 'Điểm hỗ trợ Hà Nội', description: 'Điểm tiếp nhận và phân phối hàng cứu trợ khu vực phía Bắc',
        address: 'Ba Đình, Hà Nội', createdAt: '2026-02-28T10:00:00Z', status: 'active'
    },
    {
        id: '4', lat: 16.4637, lng: 107.5909, type: 'received',
        title: 'Đã phát thuốc y tế', description: 'Phát 200 bộ kit y tế cho dân vùng lũ',
        address: 'TP Huế, Thừa Thiên Huế', createdAt: '2026-02-27T14:00:00Z', status: 'resolved'
    },
    {
        id: '5', lat: 12.2388, lng: 109.1967, type: 'need_help',
        title: 'CẦN GẠO VÀ LƯƠNG THỰC', description: '2 hộ dân đã mất hết đồ điện tử trong nhà',
        address: 'Nha Trang, Khánh Hòa', createdAt: '2026-02-26T16:00:00Z',
        items: ['Gạo', 'Rau củ quả', 'Sữa', 'Trứng'], status: 'active'
    },
    {
        id: '6', lat: 10.0452, lng: 105.7469, type: 'offering',
        title: 'Hỗ trợ dụng cụ học tập', description: 'Cung cấp sách vở, bút cho các em học sinh vùng lũ',
        address: 'Cần Thơ', createdAt: '2026-02-25T11:00:00Z',
        items: ['Sách vở', 'Bút', 'Cặp sách'], status: 'active'
    },
    {
        id: '7', lat: 13.7829, lng: 109.2196, type: 'support_point',
        title: 'Trạm cứu trợ Quy Nhơn', description: 'Điểm tiếp nhận hàng cứu trợ miền Trung',
        address: 'Quy Nhơn, Bình Định', createdAt: '2026-02-28T08:00:00Z', status: 'active'
    },
    {
        id: '8', lat: 11.9404, lng: 108.4583, type: 'received',
        title: 'Đã nhận lương thực', description: 'Đã nhận được 50 phần gạo và nhu yếu phẩm',
        address: 'Đà Lạt, Lâm Đồng', createdAt: '2026-02-26T13:00:00Z', status: 'resolved'
    },
    {
        id: '9', lat: 15.1215, lng: 108.8038, type: 'need_help',
        title: 'Cần thuốc và vật tư y tế', description: 'Trạm y tế xã thiếu thuốc sau lũ',
        address: 'Quảng Ngãi', createdAt: '2026-03-01T07:00:00Z',
        items: ['Thuốc hạ sốt', 'Băng bông', 'Thuốc đau bụng'], status: 'active'
    },
    {
        id: '10', lat: 20.8449, lng: 106.6881, type: 'support_point',
        title: 'Điểm hỗ trợ Hải Phòng', description: 'Kho hàng cứu trợ phía Bắc',
        address: 'Hải Phòng', createdAt: '2026-02-27T09:00:00Z', status: 'active'
    },
    {
        id: '11', lat: 10.3541, lng: 107.0843, type: 'offering',
        title: 'Áo quần và chăn ấm', description: '200 bộ quần áo và 100 chăn ấm',
        address: 'Vũng Tàu, Bà Rịa', createdAt: '2026-02-28T15:00:00Z', status: 'active'
    },
    {
        id: '12', lat: 14.0583, lng: 108.2772, type: 'received',
        title: 'Đã nhận nước sạch', description: 'Nhận 500 thùng nước sạch từ đoàn cứu trợ',
        address: 'Pleiku, Gia Lai', createdAt: '2026-02-25T17:00:00Z', status: 'resolved'
    },
];

const BACKEND_PING_TYPE_MAP: Record<string, PingType> = {
    SOS: 'need_help',
    Supply: 'offering',
    Shelter: 'support_point',
};

const BACKEND_PING_STATUS_MAP: Record<string, 'active' | 'resolved' | 'expired'> = {
    Pending: 'active',
    InProgress: 'active',
    Resolved: 'resolved',
    VerifiedSafe: 'resolved',
};

function formatPingLocation(lat: number, lng: number): string {
    return `GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function mapBackendPing(payload: Record<string, unknown>): PingData {
    const lat = typeof payload.lat === 'number' ? payload.lat : 0;
    const lng = typeof payload.lng === 'number' ? payload.lng : 0;
    const details = typeof payload.details === 'string' ? payload.details : '';
    const contactName = typeof payload.contactName === 'string' && payload.contactName.trim().length > 0
        ? payload.contactName
        : typeof payload.userName === 'string' && payload.userName.trim().length > 0
            ? payload.userName
            : undefined;

    return {
        id: String(payload.id),
        lat,
        lng,
        type: BACKEND_PING_TYPE_MAP[payload.type as string] || 'need_help',
        title: details || contactName || 'SOS',
        description: details,
        address: formatPingLocation(lat, lng),
        createdAt: typeof payload.createdAt === 'string' ? payload.createdAt : new Date().toISOString(),
        status: BACKEND_PING_STATUS_MAP[payload.status as string] || 'active',
        items: [],
        contactName,
        contactPhone: typeof payload.contactPhone === 'string' ? payload.contactPhone : undefined,
        contactEmail: typeof payload.contactEmail === 'string' ? payload.contactEmail : undefined,
        conditionImageUrl: typeof payload.conditionImageUrl === 'string' ? payload.conditionImageUrl : undefined,
        isBlinking: Boolean(payload.isBlinking),
        sosCategory: typeof payload.sosCategory === 'string' ? payload.sosCategory : undefined,
    };
}

export const useMapStore = create<MapState>((set, get) => ({
    center: { lat: 15.8, lng: 106.6 },
    zoom: 6,
    activeFilters: ['need_help', 'offering', 'received', 'support_point'],
    activePanel: null,
    selectedPingId: null,
    showAuthModal: null,
    resetPasswordEmail: null,
    showWelcome: !localStorage.getItem('rc-welcome-seen'),
    sidebarExpanded: false,
    pings: [],               // empty until backend responds
    pingsLoading: true,
    zones: [],
    showZones: true,
    supplyItems: [],
    showSupplyPoints: true,

    // FlyTo
    flyToTarget: null,

    // SOS draft marker
    sosDraftLocation: null,
    setSosDraftLocation: (loc) => set({ sosDraftLocation: loc }),

    // Routing
    route: null,
    isRouting: false,
    routeError: null,

    setCenter: (center) => set({ center }),
    setFlyTo: (target) => set({ flyToTarget: target }),
    setZoom: (zoom) => set({ zoom }),
    toggleFilter: (filter) => set((state) => ({
        activeFilters: state.activeFilters.includes(filter)
            ? state.activeFilters.filter(f => f !== filter)
            : [...state.activeFilters, filter]
    })),
    setActivePanel: (panel) => set((state) => ({
        activePanel: state.activePanel === panel ? null : panel
    })),
    selectPing: (id) => set({ selectedPingId: id }),
    setAuthModal: (modal) => set({ showAuthModal: modal }),
    setResetPasswordEmail: (email) => set({ resetPasswordEmail: email }),
    setShowWelcome: (show) => {
        if (!show) localStorage.setItem('rc-welcome-seen', 'true');
        set({ showWelcome: show });
    },
    setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),
    setPings: (pings) => set({ pings, pingsLoading: false }),
    upsertPing: (ping) => set((state) => {
        const existingIndex = state.pings.findIndex((item) => item.id === ping.id);
        if (existingIndex === -1) {
            return { pings: [ping, ...state.pings] };
        }

        const nextPings = [...state.pings];
        nextPings[existingIndex] = { ...nextPings[existingIndex], ...ping };
        return { pings: nextPings };
    }),
    toggleZones: () => set((state) => ({ showZones: !state.showZones })),
    toggleSupplyPoints: () => set((state) => ({ showSupplyPoints: !state.showSupplyPoints })),
    fetchPings: async () => {
        set({ pingsLoading: true });
        try {
            const res = await mapApi.getPings();
            const backendPings = (res.data as Array<Record<string, unknown>>).map(mapBackendPing);
            set({ pings: backendPings, pingsLoading: false });
        } catch {
            console.warn('[MapStore] Backend unavailable, keeping current pings');
            set({ pingsLoading: false });
        }
    },

    // Fetch pings with spatial bounds - only gets pings within visible map area
    fetchPingsInBounds: async (bounds: { north: number; south: number; east: number; west: number }) => {
        set({ pingsLoading: true });
        try {
            // Calculate center and radius from visible bounds
            const centerLat = (bounds.north + bounds.south) / 2;
            const centerLng = (bounds.east + bounds.west) / 2;
            // Proper half-diagonal distance with longitude correction
            const latKm = (bounds.north - bounds.south) * 111;
            const lngKm = (bounds.east - bounds.west) * 111 * Math.cos(centerLat * Math.PI / 180);
            // Half-diagonal + 15% margin to cover viewport corners
            const radiusKm = Math.sqrt(latKm * latKm + lngKm * lngKm) / 2 * 1.15;

            const res = await mapApi.getPings({
                lat: centerLat,
                lng: centerLng,
                radiusKm: Math.max(radiusKm, 20), // 20km minimum; backend validates ≤10000km
            });
            const backendPings = (res.data as Array<Record<string, unknown>>).map(mapBackendPing);
            set({ pings: backendPings, pingsLoading: false });
        } catch {
            console.warn('[MapStore] Failed to fetch pings in bounds');
            set({ pingsLoading: false });
        }
    },

    fetchZones: async () => {
        try {
            const res = await mapApi.getZones();
            const backendZones: ZoneData[] = (res.data as Array<Record<string, unknown>>).map((z) => {
                // Parse GeoJSON boundary string into coordinate array
                let boundary: Array<{ lat: number; lng: number }> = [];
                try {
                    const geoJson = typeof z.boundaryGeoJson === 'string'
                        ? JSON.parse(z.boundaryGeoJson)
                        : z.boundaryGeoJson;
                    // Support GeoJSON Polygon: { type: "Polygon", coordinates: [[[lng, lat], ...]] }
                    if (geoJson?.type === 'Polygon' && Array.isArray(geoJson.coordinates?.[0])) {
                        boundary = geoJson.coordinates[0].map((coord: number[]) => ({
                            lat: coord[1],
                            lng: coord[0],
                        }));
                    }
                    // Support plain coordinate array: [[lng, lat], ...]
                    else if (Array.isArray(geoJson)) {
                        boundary = geoJson.map((coord: number[]) => ({
                            lat: coord[1],
                            lng: coord[0],
                        }));
                    }
                } catch {
                    console.warn('[MapStore] Failed to parse zone boundary:', z.id);
                }
                return {
                    id: z.id as number,
                    name: (z.name as string) || '',
                    riskLevel: (z.riskLevel as number) || 1,
                    boundary,
                };
            });
            set({ zones: backendZones });
        } catch {
            console.warn('[MapStore] Failed to fetch zones');
        }
    },

    fetchRoute: async (destLat: number, destLng: number) => {
        set({ isRouting: true, routeError: null });
        try {
            // Get user's current location via browser Geolocation API
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error('Geolocation is not supported'));
                    return;
                }
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000,
                });
            });

            const originLat = position.coords.latitude;
            const originLng = position.coords.longitude;

            // Call OSRM public API for driving directions
            // alternatives=2 requests up to 2 alternative routes; continue_straight=false encourages diverse alternatives
            const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson&alternatives=2&continue_straight=false`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('OSRM request failed');

            const data = await response.json();
            if (data.code !== 'Ok' || !data.routes?.length) {
                throw new Error('No route found');
            }

            const primary = data.routes[0];
            const primaryCoords: Array<[number, number]> = primary.geometry.coordinates.map(
                (c: [number, number]) => [c[1], c[0]] // GeoJSON [lng,lat] → Leaflet [lat,lng]
            );
            const primaryInfo: RouteInfo = {
                distanceKm: Math.round((primary.distance / 1000) * 10) / 10,
                durationMin: Math.round(primary.duration / 60),
            };

            // Extract up to 2 alternative routes
            const alternatives: Array<{ coordinates: Array<[number, number]>; info: RouteInfo }> = [];
            for (let i = 1; i <= 2 && i < data.routes.length; i++) {
                const alt = data.routes[i];
                alternatives.push({
                    coordinates: alt.geometry.coordinates.map(
                        (c: [number, number]) => [c[1], c[0]]
                    ),
                    info: {
                        distanceKm: Math.round((alt.distance / 1000) * 10) / 10,
                        durationMin: Math.round(alt.duration / 60),
                    },
                });
            }

            set({
                route: {
                    coordinates: primaryCoords,
                    alternatives,
                    info: primaryInfo,
                    selectedIndex: 0,
                    origin: { lat: originLat, lng: originLng },
                    destination: { lat: destLat, lng: destLng },
                },
                isRouting: false,
            });
        } catch (err) {
            const message = err instanceof GeolocationPositionError
                ? 'Không thể xác định vị trí. Vui lòng bật GPS.'
                : err instanceof Error ? err.message : 'Routing failed';
            set({ isRouting: false, routeError: message });
            console.warn('[MapStore] Routing error:', message);
        }
    },

    clearRoute: () => set({ route: null, routeError: null }),

    selectRouteIndex: (index: number) => {
        const { route } = get();
        if (!route) return;
        const maxIndex = route.alternatives.length; // 0 = primary, 1..N = alternatives
        if (index < 0 || index > maxIndex) return;
        set({ route: { ...route, selectedIndex: index } });
    },

    fetchSupplyItems: async () => {
        try {
            const res = await supplyApi.getSupplies();
            const items: SupplyData[] = (res.data as Array<Record<string, unknown>>).map((s) => ({
                id: s.id as number,
                name: (s.name as string) || '',
                quantity: (s.quantity as number) || 0,
                lat: s.lat as number,
                lng: s.lng as number,
            }));
            set({ supplyItems: items });
        } catch {
            console.warn('[MapStore] Failed to fetch supply items');
        }
    },

    removePing: (id) => set((state) => ({ pings: state.pings.filter((p) => p.id !== id) })),
}));
