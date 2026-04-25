import { create } from 'zustand';
import { mapApi, supplyApi } from '../services/api';

export type PingType = 'need_help' | 'offering' | 'received' | 'support_point';
export type PanelType = 'list' | 'social' | 'chat' | 'profile' | 'verify' | 'guide' | 'my-sos' | 'volunteer' | 'sponsor' | 'messages' | null;

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
    userId?: string;
    userAvatarUrl?: string;
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
    /** Alternative routes coordinates (up to 1) */
    alternatives: Array<{ coordinates: Array<[number, number]>; info: RouteInfo }>;
    /** Route summary */
    info: RouteInfo;
    /** Currently selected route index (0 = primary, 1 = alt1) */
    selectedIndex: number;
    /** Origin point */
    origin: { lat: number; lng: number };
    /** Destination point */
    destination: { lat: number; lng: number };
}

interface OsrmPoint {
    lat: number;
    lng: number;
}

interface OsrmRoute {
    distance: number;
    duration: number;
    geometry: {
        coordinates: Array<[number, number]>;
    };
    legs?: Array<{
        annotation?: {
            nodes?: number[];
        };
    }>;
}

interface OsrmResponse {
    code?: string;
    message?: string;
    routes?: OsrmRoute[];
}

interface CachedRouteOrigin {
    lat: number;
    lng: number;
    timestamp: number;
}

type RouteVariant = { coordinates: Array<[number, number]>; info: RouteInfo };
type RouteCandidate = RouteVariant & { nodeIds: number[]; signature: string };

const OSRM_ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving';
const MAX_TOTAL_ROUTES = 2;
const MAX_ROUTE_ALTERNATIVES = MAX_TOTAL_ROUTES - 1;
const NATIVE_ALTERNATIVE_CANDIDATES = 3;
const MAX_FALLBACK_ROUTE_REQUESTS = 4;
const FALLBACK_ROUTE_BATCH_SIZE = 2;
const FALLBACK_ROUTE_TIME_BUDGET_MS = 2200;
const ROUTE_SAMPLE_POINTS = 16;
const PRIMARY_OSRM_TIMEOUT_MS = 4500;
const FALLBACK_OSRM_TIMEOUT_MS = 1800;
const ROUTE_GEOLOCATION_TIMEOUT_MS = 3500;
const ROUTE_GEOLOCATION_MAXIMUM_AGE_MS = 180000;
const ROUTE_ORIGIN_CACHE_TTL_MS = 180000;

let cachedRouteOrigin: CachedRouteOrigin | null = null;

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function toLeafletCoordinates(coordinates: Array<[number, number]>): Array<[number, number]> {
    return coordinates.map((coord) => [coord[1], coord[0]]);
}

function toRouteInfo(route: OsrmRoute): RouteInfo {
    return {
        distanceKm: Math.round((route.distance / 1000) * 10) / 10,
        durationMin: Math.round(route.duration / 60),
    };
}

function extractRouteNodeIds(route: OsrmRoute): number[] {
    return (route.legs ?? [])
        .flatMap((leg) => leg.annotation?.nodes ?? [])
        .filter((node): node is number => Number.isFinite(node));
}

function toRouteCandidate(route: OsrmRoute): RouteCandidate {
    const coordinates = toLeafletCoordinates(route.geometry.coordinates);
    return {
        coordinates,
        info: toRouteInfo(route),
        nodeIds: extractRouteNodeIds(route),
        signature: buildRouteSignature(coordinates),
    };
}

function buildOsrmUrl(points: OsrmPoint[], alternatives: boolean | number): string {
    const waypointString = points.map((point) => `${point.lng},${point.lat}`).join(';');
    const params = new URLSearchParams({
        overview: 'full',
        geometries: 'geojson',
        alternatives: String(alternatives),
        annotations: 'nodes',
        continue_straight: 'false',
    });

    return `${OSRM_ROUTE_URL}/${waypointString}?${params.toString()}`;
}

function extractAlternativeLimit(message?: string): number | null {
    if (!message) return null;

    const match = message.match(/maximum\s*\((\d+)\)/i);
    if (!match) return null;

    const parsed = Number(match[1]);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function fetchOsrmRoutes(points: OsrmPoint[], alternatives: boolean | number): Promise<OsrmRoute[]> {
    const timeoutMs = alternatives === false ? FALLBACK_OSRM_TIMEOUT_MS : PRIMARY_OSRM_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
        response = await fetch(buildOsrmUrl(points, alternatives), { signal: controller.signal });
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw new Error('OSRM request timed out');
        }

        throw error;
    } finally {
        clearTimeout(timeoutId);
    }

    const data = await response.json().catch(() => null) as OsrmResponse | null;

    if (!response.ok) {
        const cappedAlternatives = typeof alternatives === 'number'
            ? extractAlternativeLimit(data?.message)
            : null;

        if (
            typeof alternatives === 'number'
            && cappedAlternatives !== null
            && cappedAlternatives > 0
            && cappedAlternatives < alternatives
        ) {
            return fetchOsrmRoutes(points, cappedAlternatives);
        }

        throw new Error(data?.message || data?.code || `OSRM request failed (${response.status})`);
    }

    if (!data || data.code !== 'Ok' || !data.routes?.length) {
        throw new Error(data?.message || data?.code || 'No route found');
    }

    return data.routes;
}

function buildRouteSignature(coordinates: Array<[number, number]>): string {
    if (coordinates.length === 0) return '';

    const maxSamples = Math.min(8, coordinates.length);
    if (maxSamples === 1) {
        const [lat, lng] = coordinates[0];
        return `${lat.toFixed(3)}:${lng.toFixed(3)}`;
    }

    const sampled: string[] = [];
    for (let index = 0; index < maxSamples; index += 1) {
        const coordIndex = Math.round((index / (maxSamples - 1)) * (coordinates.length - 1));
        const [lat, lng] = coordinates[coordIndex];
        sampled.push(`${lat.toFixed(3)}:${lng.toFixed(3)}`);
    }

    return sampled.join('|');
}

function sampleCoordinates(coordinates: Array<[number, number]>, sampleCount = ROUTE_SAMPLE_POINTS): Array<[number, number]> {
    if (coordinates.length <= sampleCount) return coordinates;

    const sampled: Array<[number, number]> = [];
    for (let index = 0; index < sampleCount; index += 1) {
        const coordIndex = Math.round((index / (sampleCount - 1)) * (coordinates.length - 1));
        sampled.push(coordinates[coordIndex]);
    }

    return sampled;
}

function haversineDistanceKm(first: [number, number], second: [number, number]): number {
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const latDiff = toRadians(second[0] - first[0]);
    const lngDiff = toRadians(second[1] - first[1]);
    const lat1 = toRadians(first[0]);
    const lat2 = toRadians(second[0]);

    const a = Math.sin(latDiff / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDiff / 2) ** 2;

    return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeAverageNearestDistanceKm(source: Array<[number, number]>, target: Array<[number, number]>): number {
    if (source.length === 0 || target.length === 0) return 0;

    let totalDistance = 0;
    for (const sourcePoint of source) {
        let nearestDistance = Number.POSITIVE_INFINITY;
        for (const targetPoint of target) {
            nearestDistance = Math.min(nearestDistance, haversineDistanceKm(sourcePoint, targetPoint));
        }
        totalDistance += nearestDistance;
    }

    return totalDistance / source.length;
}

function computeRouteDeviationKm(primaryCoordinates: Array<[number, number]>, candidateCoordinates: Array<[number, number]>): number {
    const primarySamples = sampleCoordinates(primaryCoordinates);
    const candidateSamples = sampleCoordinates(candidateCoordinates);

    return (
        computeAverageNearestDistanceKm(primarySamples, candidateSamples)
        + computeAverageNearestDistanceKm(candidateSamples, primarySamples)
    ) / 2;
}

function computeRouteNodeOverlapRatio(primaryNodeIds: number[], candidateNodeIds: number[]): number | null {
    const primaryNodes = new Set(primaryNodeIds);
    const candidateNodes = new Set(candidateNodeIds);

    if (primaryNodes.size === 0 || candidateNodes.size === 0) {
        return null;
    }

    const [smaller, larger] = primaryNodes.size <= candidateNodes.size
        ? [primaryNodes, candidateNodes]
        : [candidateNodes, primaryNodes];

    let shared = 0;
    for (const nodeId of smaller) {
        if (larger.has(nodeId)) {
            shared += 1;
        }
    }

    return shared / Math.min(primaryNodes.size, candidateNodes.size);
}

function isAcceptableAlternative(primary: RouteVariant, candidate: RouteVariant): boolean {
    const maxDistanceKm = Math.max(primary.info.distanceKm * 1.65, primary.info.distanceKm + 25);
    const maxDurationMin = Math.max(primary.info.durationMin * 1.75, primary.info.durationMin + 20);

    return candidate.info.distanceKm <= maxDistanceKm && candidate.info.durationMin <= maxDurationMin;
}

function scoreAlternativeCandidate(primary: RouteCandidate, candidate: RouteCandidate): { deviationKm: number; overlapRatio: number | null; score: number } {
    const overlapRatio = computeRouteNodeOverlapRatio(primary.nodeIds, candidate.nodeIds);
    const deviationKm = computeRouteDeviationKm(primary.coordinates, candidate.coordinates);
    const normalizedDeviation = clamp(deviationKm / Math.max(0.25, Math.min(primary.info.distanceKm * 0.08, 3)), 0, 1.2);
    const overlapPenalty = overlapRatio ?? 0.55;
    const distancePenalty = clamp(
        (candidate.info.distanceKm - primary.info.distanceKm) / Math.max(6, primary.info.distanceKm * 0.45),
        0,
        1.5
    );
    const durationPenalty = clamp(
        (candidate.info.durationMin - primary.info.durationMin) / Math.max(5, primary.info.durationMin * 0.45),
        0,
        1.5
    );

    return {
        deviationKm,
        overlapRatio,
        score: (1 - overlapPenalty) * 0.7 + normalizedDeviation * 0.45 - distancePenalty * 0.2 - durationPenalty * 0.2,
    };
}

function rankAlternativeCandidates(primary: RouteCandidate, candidates: RouteCandidate[]) {
    const seen = new Set<string>([primary.signature]);
    const deduped = candidates.filter((candidate) => {
        if (!candidate.signature || seen.has(candidate.signature)) return false;
        seen.add(candidate.signature);
        return true;
    });

    const scored = deduped
        .filter((candidate) => isAcceptableAlternative(primary, candidate))
        .map((candidate) => {
            const { deviationKm, overlapRatio, score } = scoreAlternativeCandidate(primary, candidate);
            return {
                candidate,
                deviationKm,
                overlapRatio,
                score,
            };
        });

    // Only keep alternatives that represent genuinely different paths.
    // Filter out routes that share most of the same roads or only deviate
    // by a single turn — those aren't useful to the user.
    const distinctEnough = scored.filter((entry) => {
        // Hard reject: very high road overlap with tiny spatial deviation
        // (just a minor detour on essentially the same path)
        if (entry.overlapRatio !== null && entry.overlapRatio >= 0.7 && entry.deviationKm < 0.5) {
            return false;
        }

        // Require meaningful deviation: either significantly different roads,
        // OR substantial spatial separation from the primary route
        const hasDifferentRoads = (entry.overlapRatio ?? 1) < 0.7;
        const hasSignificantDeviation = entry.deviationKm >= 0.5;
        const hasGoodScore = entry.score >= 0.25;

        return (hasDifferentRoads || hasSignificantDeviation) && hasGoodScore;
    });

    return (distinctEnough.length > 0 ? distinctEnough : [])
        .sort((first, second) => second.score - first.score || first.candidate.info.durationMin - second.candidate.info.durationMin);
}

function selectBestAlternatives(primary: RouteCandidate, candidates: RouteCandidate[]): RouteVariant[] {
    return rankAlternativeCandidates(primary, candidates)
        .slice(0, MAX_ROUTE_ALTERNATIVES)
        .map(({ candidate }) => ({
            coordinates: candidate.coordinates,
            info: candidate.info,
        }));
}

function shouldExpandWithFallback(primary: RouteCandidate, candidates: RouteCandidate[]): boolean {
    if (candidates.length >= MAX_ROUTE_ALTERNATIVES) return false;
    if (candidates.length > 0) return false;

    return primary.info.distanceKm <= 45 && primary.info.durationMin <= 70;
}

function getFreshRouteOrigin(): OsrmPoint | null {
    if (!cachedRouteOrigin) return null;
    if (Date.now() - cachedRouteOrigin.timestamp > ROUTE_ORIGIN_CACHE_TTL_MS) return null;

    return {
        lat: cachedRouteOrigin.lat,
        lng: cachedRouteOrigin.lng,
    };
}

async function resolveRouteOrigin(): Promise<OsrmPoint> {
    const freshOrigin = getFreshRouteOrigin();
    if (freshOrigin) {
        return freshOrigin;
    }

    const staleOrigin = cachedRouteOrigin
        ? { lat: cachedRouteOrigin.lat, lng: cachedRouteOrigin.lng }
        : null;

    try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: false,
                timeout: ROUTE_GEOLOCATION_TIMEOUT_MS,
                maximumAge: ROUTE_GEOLOCATION_MAXIMUM_AGE_MS,
            });
        });

        cachedRouteOrigin = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: Date.now(),
        };

        return {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
        };
    } catch (error) {
        if (staleOrigin) {
            return staleOrigin;
        }

        throw error;
    }
}

function offsetCoordinate(anchor: [number, number], direction: [number, number], offsetKm: number): OsrmPoint {
    const [lat, lng] = anchor;
    const meters = offsetKm * 1000;
    const metersPerDegreeLat = 111_320;
    const metersPerDegreeLng = Math.max(1, 111_320 * Math.cos((lat * Math.PI) / 180));

    return {
        lat: lat + ((direction[0] * meters) / metersPerDegreeLat),
        lng: lng + ((direction[1] * meters) / metersPerDegreeLng),
    };
}

function buildAlternativeWaypointCandidates(primaryCoordinates: Array<[number, number]>, distanceKm: number): OsrmPoint[] {
    if (primaryCoordinates.length < 3) return [];

    const anchorFractions = distanceKm < 8
        ? [0.28, 0.5, 0.72]
        : [0.22, 0.4, 0.6, 0.78];
    const baseOffsetKm = clamp(distanceKm * 0.035, 0.3, 4.5);
    const offsetMultipliers = distanceKm < 8 ? [0.85, 1.35] : [0.75, 1.15];
    const candidates: OsrmPoint[] = [];

    for (const fraction of anchorFractions) {
        const index = clamp(Math.round((primaryCoordinates.length - 1) * fraction), 1, primaryCoordinates.length - 2);
        const prev = primaryCoordinates[Math.max(0, index - 6)];
        const anchor = primaryCoordinates[index];
        const next = primaryCoordinates[Math.min(primaryCoordinates.length - 1, index + 6)];

        const latDelta = next[0] - prev[0];
        const lngDelta = next[1] - prev[1];
        const vectorLength = Math.hypot(latDelta, lngDelta);
        if (vectorLength === 0) continue;

        const perpendicular: [number, number] = [
            -lngDelta / vectorLength,
            latDelta / vectorLength,
        ];

        for (const multiplier of offsetMultipliers) {
            const offsetKm = baseOffsetKm * multiplier;
            candidates.push(offsetCoordinate(anchor, perpendicular, offsetKm));
            candidates.push(offsetCoordinate(anchor, [-perpendicular[0], -perpendicular[1]], offsetKm));
        }
    }

    const seen = new Set<string>();
    return candidates.filter((candidate) => {
        const key = `${candidate.lat.toFixed(5)}:${candidate.lng.toFixed(5)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, MAX_FALLBACK_ROUTE_REQUESTS);
}

async function buildFallbackAlternatives(
    origin: OsrmPoint,
    destination: OsrmPoint,
    primary: RouteCandidate,
    existingAlternatives: RouteCandidate[]
): Promise<RouteCandidate[]> {
    const existingSignatures = new Set<string>([
        primary.signature,
        ...existingAlternatives.map((route) => route.signature),
    ]);

    const waypoints = buildAlternativeWaypointCandidates(primary.coordinates, primary.info.distanceKm);
    if (waypoints.length === 0) return [];

    const alternatives: RouteCandidate[] = [];

    const startedAt = Date.now();
    for (let index = 0; index < waypoints.length; index += FALLBACK_ROUTE_BATCH_SIZE) {
        if (alternatives.length >= MAX_ROUTE_ALTERNATIVES) break;
        if (Date.now() - startedAt >= FALLBACK_ROUTE_TIME_BUDGET_MS) break;

        const batch = waypoints.slice(index, index + FALLBACK_ROUTE_BATCH_SIZE);
        const candidateResponses = await Promise.all(batch.map(async (waypoint) => {
            try {
                const routes = await fetchOsrmRoutes([origin, waypoint, destination], false);
                return routes[0] ?? null;
            } catch {
                return null;
            }
        }));

        for (const candidate of candidateResponses) {
            if (!candidate) continue;

            const route = toRouteCandidate(candidate);
            const signature = route.signature;
            if (!signature || existingSignatures.has(signature)) continue;

            if (!isAcceptableAlternative(primary, route)) continue;

            existingSignatures.add(signature);
            alternatives.push(route);

            if (alternatives.length >= MAX_ROUTE_ALTERNATIVES) {
                break;
            }
        }
    }

    return alternatives;
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

    // Mobile SOS trigger (incremented by MobileNav to fire SOSCreationFlow)
    sosTriggerCount: number;
    triggerSOS: () => void;
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
        userId: typeof payload.userId === 'string' && payload.userId.trim().length > 0 ? payload.userId : undefined,
        userAvatarUrl: typeof payload.avatarUrl === 'string' && payload.avatarUrl.trim().length > 0 ? payload.avatarUrl : undefined,
    };
}

// ─── Ping cache bounds tracking ───
// Tracks the largest geographic area we've already fetched pings for.
// When the user zooms in, the viewport shrinks inside this area → no API call needed.
// When the user pans/zooms out beyond this area → fetch new pings and expand the cached region.
let cachedPingsBounds: { north: number; south: number; east: number; west: number } | null = null;
let lastFetchedBoundsKey = '';

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

    // Mobile SOS trigger
    sosTriggerCount: 0,
    triggerSOS: () => set((state) => ({ sosTriggerCount: state.sosTriggerCount + 1 })),

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
            // Reset bounds cache since we just loaded the full dataset
            cachedPingsBounds = null;
            lastFetchedBoundsKey = '';
        } catch {
            console.warn('[MapStore] Backend unavailable, keeping current pings');
            set({ pingsLoading: false });
        }
    },

    // Fetch pings with spatial bounds — merge strategy to avoid cache invalidation on zoom.
    // Instead of replacing the entire pings array (which clears pings outside viewport on zoom-in),
    // we merge new results with the existing cache and only call the API when the viewport extends
    // beyond what we've already fetched.
    fetchPingsInBounds: async (bounds: { north: number; south: number; east: number; west: number }) => {
        // Skip if the new bounds are entirely within what we've already fetched (zoom-in case)
        const cached = cachedPingsBounds;
        if (
            cached &&
            bounds.north <= cached.north &&
            bounds.south >= cached.south &&
            bounds.east <= cached.east &&
            bounds.west >= cached.west
        ) {
            // Already have all data for this viewport — no API call needed
            return;
        }

        // Debounce protection: skip if we just fetched with a very similar bounds
        const boundsKey = `${bounds.north.toFixed(3)}:${bounds.south.toFixed(3)}:${bounds.east.toFixed(3)}:${bounds.west.toFixed(3)}`;
        if (boundsKey === lastFetchedBoundsKey) return;

        set({ pingsLoading: true });
        try {
            // Expand the fetch area by 50% to pre-fetch surrounding pings and reduce future calls
            const latSpan = bounds.north - bounds.south;
            const lngSpan = bounds.east - bounds.west;
            const expandedBounds = {
                north: bounds.north + latSpan * 0.25,
                south: bounds.south - latSpan * 0.25,
                east: bounds.east + lngSpan * 0.25,
                west: bounds.west - lngSpan * 0.25,
            };

            // Calculate center and radius from expanded bounds
            const centerLat = (expandedBounds.north + expandedBounds.south) / 2;
            const centerLng = (expandedBounds.east + expandedBounds.west) / 2;
            const latKm = (expandedBounds.north - expandedBounds.south) * 111;
            const lngKm = (expandedBounds.east - expandedBounds.west) * 111 * Math.cos(centerLat * Math.PI / 180);
            const radiusKm = Math.sqrt(latKm * latKm + lngKm * lngKm) / 2 * 1.15;

            const res = await mapApi.getPings({
                lat: centerLat,
                lng: centerLng,
                radiusKm: Math.max(radiusKm, 20), // 20km minimum; backend validates ≤10000km
            });
            const backendPings = (res.data as Array<Record<string, unknown>>).map(mapBackendPing);

            // Merge new pings with existing cache (upsert by ID)
            set((state) => {
                const pingMap = new Map(state.pings.map((p) => [p.id, p]));
                for (const ping of backendPings) {
                    pingMap.set(ping.id, ping); // overwrite with fresh data
                }
                return { pings: Array.from(pingMap.values()), pingsLoading: false };
            });

            // Update cached bounds to the union of old + new expanded bounds
            if (cached) {
                cachedPingsBounds = {
                    north: Math.max(cached.north, expandedBounds.north),
                    south: Math.min(cached.south, expandedBounds.south),
                    east: Math.max(cached.east, expandedBounds.east),
                    west: Math.min(cached.west, expandedBounds.west),
                };
            } else {
                cachedPingsBounds = { ...expandedBounds };
            }
            lastFetchedBoundsKey = boundsKey;
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
            const origin = await resolveRouteOrigin();
            const destination = { lat: destLat, lng: destLng };

            // First ask OSRM for native alternatives. If it returns too few, add fallback
            // routes by nudging a waypoint off the primary path so shorter trips still get choices.
            const routes = await fetchOsrmRoutes([origin, destination], NATIVE_ALTERNATIVE_CANDIDATES);
            const primary = toRouteCandidate(routes[0]);
            const nativeCandidates = routes.slice(1).map((route) => toRouteCandidate(route));

            const routeCandidates = [...nativeCandidates];
            if (shouldExpandWithFallback(primary, nativeCandidates)) {
                const fallbackAlternatives = await buildFallbackAlternatives(origin, destination, primary, nativeCandidates);
                routeCandidates.push(...fallbackAlternatives);
            }

            const selectedAlternatives = selectBestAlternatives(primary, routeCandidates);

            set({
                route: {
                    coordinates: primary.coordinates,
                    alternatives: selectedAlternatives,
                    info: primary.info,
                    selectedIndex: 0,
                    origin,
                    destination,
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
