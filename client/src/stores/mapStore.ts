import { create } from 'zustand';
import { mapApi } from '../services/api';

export type PingType = 'need_help' | 'offering' | 'received' | 'support_point';
export type PanelType = 'list' | 'social' | 'chat' | 'profile' | null;

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
    contactPhone?: string;
    status: 'active' | 'resolved' | 'expired';
}

export interface ZoneData {
    id: number;
    name: string;
    riskLevel: number;
    boundary: Array<{ lat: number; lng: number }>;
}

export interface RouteInfo {
    distanceKm: number;
    durationMin: number;
}

export interface RouteData {
    /** Primary route coordinates */
    coordinates: Array<[number, number]>;
    /** Alternative route coordinates (if available) */
    alternative: Array<[number, number]> | null;
    /** Route summary */
    info: RouteInfo;
    /** Alternative route summary */
    alternativeInfo: RouteInfo | null;
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
    showWelcome: boolean;
    sidebarExpanded: boolean;
    pings: PingData[];
    zones: ZoneData[];
    showZones: boolean;

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
    setShowWelcome: (show: boolean) => void;
    setSidebarExpanded: (expanded: boolean) => void;
    setPings: (pings: PingData[]) => void;
    toggleZones: () => void;
    fetchPings: () => Promise<void>;
    fetchZones: () => Promise<void>;
    fetchRoute: (destLat: number, destLng: number) => Promise<void>;
    clearRoute: () => void;
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

export const useMapStore = create<MapState>((set) => ({
    center: { lat: 15.8, lng: 106.6 },
    zoom: 6,
    activeFilters: ['need_help', 'offering', 'received', 'support_point'],
    activePanel: null,
    selectedPingId: null,
    showAuthModal: null,
    showWelcome: !localStorage.getItem('rc-welcome-seen'),
    sidebarExpanded: false,
    pings: [],
    zones: [],
    showZones: true,

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
    setShowWelcome: (show) => {
        if (!show) localStorage.setItem('rc-welcome-seen', 'true');
        set({ showWelcome: show });
    },
    setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),
    setPings: (pings) => set({ pings }),
    toggleZones: () => set((state) => ({ showZones: !state.showZones })),
    fetchPings: async () => {
        try {
            const res = await mapApi.getPings();
            const backendPings: PingData[] = (res.data as Array<Record<string, unknown>>).map((p) => {
                const typeMap: Record<string, PingType> = {
                    SOS: 'need_help',
                    Supply: 'offering',
                    Shelter: 'support_point',
                };
                const statusMap: Record<string, 'active' | 'resolved' | 'expired'> = {
                    Pending: 'active',
                    InProgress: 'active',
                    Resolved: 'resolved',
                    VerifiedSafe: 'resolved',
                };
                return {
                    id: String(p.id),
                    lat: p.lat as number,
                    lng: p.lng as number,
                    type: typeMap[p.type as string] || 'need_help',
                    title: (p.details as string) || 'SOS',
                    description: (p.details as string) || '',
                    address: '',
                    createdAt: p.createdAt as string,
                    status: statusMap[p.status as string] || 'active',
                    items: [],
                    contactPhone: undefined,
                };
            });
            set({ pings: backendPings });
        } catch {
            console.warn('[MapStore] Backend unavailable, using mock pings');
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
            const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson&alternatives=true`;
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

            let alternativeCoords: Array<[number, number]> | null = null;
            let alternativeInfo: RouteInfo | null = null;
            if (data.routes.length > 1) {
                const alt = data.routes[1];
                alternativeCoords = alt.geometry.coordinates.map(
                    (c: [number, number]) => [c[1], c[0]]
                );
                alternativeInfo = {
                    distanceKm: Math.round((alt.distance / 1000) * 10) / 10,
                    durationMin: Math.round(alt.duration / 60),
                };
            }

            set({
                route: {
                    coordinates: primaryCoords,
                    alternative: alternativeCoords,
                    info: primaryInfo,
                    alternativeInfo,
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
}));
