import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useMapStore, type PingData, type PingType, type SupplyData } from '../../stores/mapStore';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { ISLAND_ZONES } from '../../utils/vietnamTerritory';

// ─── Vietnam bounds (rectangle covering mainland + islands, 1.2× padding) ───
// Vietnam extent including Paracel & Spratly islands: ~6.5°N–23.4°N, ~102.1°E–117.8°E
// Center: 14.95°N, 109.95°E — scaled 1.2× → ±10.14° lat, ±9.42° lng
const VIETNAM_BOUNDS: L.LatLngBoundsExpression = [
  [4.81, 100.53],  // Southwest corner (with 1.2× padding)
  [25.09, 119.37], // Northeast corner (with 1.2× padding)
];

// ─── Tile layer URLs ───
const LIGHT_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// ─── Ping marker colors & SVG icons ───
const PING_COLORS: Record<PingType, string> = {
  need_help: '#ef4444',
  offering: '#22c55e',
  received: '#f59e0b',
  support_point: '#f97316',
};

const PING_SVGS: Record<PingType, string> = {
  need_help:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  offering:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
  received:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  support_point:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
};

// Category-specific SVG icons for SOS pings
const SOS_CATEGORY_SVGS: Record<string, string> = {
  // Evacuate: running person
  evacuate:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="4" r="2"/><path d="m12 12-2-3-3 5h5l3-5-3-2"/><path d="m9 20 1.5-5"/><path d="M16 20l-1-4"/><path d="m19 12-2.5-4"/><path d="M6 17l2-5"/></svg>',
  // Food: utensils (fork + knife)
  food:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>',
  // Medical: heart pulse
  medical:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/></svg>',
  // Shelter: house
  shelter:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  // Other: default warning triangle (same as need_help)
  other:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
};

// Category-specific background colors for SOS pings
const SOS_CATEGORY_COLORS: Record<string, string> = {
  evacuate: '#f97316', // orange
  food: '#eab308',     // amber/yellow
  medical: '#ef4444',  // red
  shelter: '#8b5cf6',  // purple
  other: '#dc2626',    // dark red (default SOS)
};

/** DivIcon cache — keyed by type+category+selected+pulsing */
const pingIconCache = new Map<string, L.DivIcon>();

/** Create a Leaflet DivIcon for a ping marker (cached) */
function createPingIcon(ping: PingData, isSelected: boolean): L.DivIcon {
  const cat = ping.type === 'need_help' && ping.sosCategory ? ping.sosCategory.toLowerCase() : '';
  const cacheKey = `${ping.type}|${cat}|${isSelected ? 1 : 0}|${ping.isBlinking ? 1 : 0}`;

  let icon = pingIconCache.get(cacheKey);
  if (icon) return icon;

  // Use category-specific icon and color for SOS (need_help) pings
  let color: string;
  let svg: string;
  if (cat) {
    color = SOS_CATEGORY_COLORS[cat] || PING_COLORS[ping.type];
    svg = SOS_CATEGORY_SVGS[cat] || PING_SVGS[ping.type];
  } else {
    color = PING_COLORS[ping.type];
    svg = PING_SVGS[ping.type];
  }
  const isPulsing = ping.isBlinking === true;
  icon = L.divIcon({
    className: '', // no default leaflet icon styles
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `<button class="map-marker ${isSelected ? 'map-marker-selected' : ''} ${isPulsing ? 'map-marker-pulse' : ''}" style="background-color:${color}" aria-label="${ping.type}">${svg}</button>`,
  });

  pingIconCache.set(cacheKey, icon);
  return icon;
}

/** Supply icon cache — keyed by hasStock boolean */
const supplyIconCache = new Map<string, L.DivIcon>();

/** Create a Leaflet DivIcon for a supply marker (cached) */
function createSupplyIcon(supply: SupplyData): L.DivIcon {
  const hasStock = supply.quantity > 0;
  const cacheKey = hasStock ? '1' : '0';

  let icon = supplyIconCache.get(cacheKey);
  if (icon) return icon;

  const color = hasStock ? '#3b82f6' : '#6b7280';
  icon = L.divIcon({
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    html: `<button class="map-marker" style="background-color:${color};width:32px;height:32px" aria-label="supply"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg></button>`,
  });

  supplyIconCache.set(cacheKey, icon);
  return icon;
}

// ─── Zone risk level colors ───
const ZONE_COLORS: Record<number, string> = {
  1: '#22c55e', // Green — low risk
  2: '#eab308', // Yellow
  3: '#f97316', // Orange
  4: '#ef4444', // Red
  5: '#dc2626', // Dark red — critical
};

// ─── Main Component ───
export default function MapView() {
  const {
    center, zoom, activeFilters, pings, zones, showZones,
    selectedPingId, selectPing, setCenter, setZoom, route,
    flyToTarget, setFlyTo, sosDraftLocation, fetchPingsInBounds,
    supplyItems, showSupplyPoints, fetchSupplyItems,
  } = useMapStore();
  const { isDark } = useTheme();
  const { t } = useLanguage();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const zoneLayersRef = useRef<L.Polygon[]>([]);
  const routeLayersRef = useRef<L.Polyline[]>([]);
  const routeMarkersRef = useRef<L.CircleMarker[]>([]);
  const sosDraftMarkerRef = useRef<L.Marker | null>(null);
  const supplyLayerRef = useRef<L.LayerGroup | null>(null);
  const supplyMarkersRef = useRef<Map<number, L.Marker>>(new Map());
  const islandMarkersRef = useRef<L.Marker[]>([]);
  const territoryLineRef = useRef<L.Polygon | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  // Debounce timer ref for map move/zoom events
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredPings = useMemo(() => {
    const filterSet = new Set(activeFilters);
    return pings.filter((p) => filterSet.has(p.type));
  }, [pings, activeFilters]);

  // ─── Debounced fetch pings in bounds ───
  const debouncedFetchInBounds = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      const map = mapRef.current;
      if (map) {
        const bounds = map.getBounds();
        fetchPingsInBounds({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        });
      }
    }, 300);
  }, [fetchPingsInBounds]);

  // ─── Initialize map (once) ───
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    try {
      const map = L.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom,
        minZoom: 5,
        maxZoom: 18,
        maxBounds: VIETNAM_BOUNDS,
        maxBoundsViscosity: 0.8,
        zoomControl: true,
        attributionControl: true,
      });

      const tileUrl = isDark ? DARK_TILES : LIGHT_TILES;
      const tile = L.tileLayer(tileUrl, {
        attribution: TILE_ATTRIBUTION,
        maxZoom: 19,
      }).addTo(map);

      // Sync store on user interaction with debounced pings fetch
      map.on('moveend', () => {
        const c = map.getCenter();
        setCenter({ lat: c.lat, lng: c.lng });
        debouncedFetchInBounds();
      });
      map.on('zoomend', () => {
        setZoom(map.getZoom());
        debouncedFetchInBounds();
      });
      map.on('click', () => {
        selectPing(null);
      });

      mapRef.current = map;
      tileRef.current = tile;

      // Create marker cluster group
      const clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 60,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        disableClusteringAtZoom: 15,
        spiderfyDistanceMultiplier: 1.5,
        chunkedLoading: true,
      });
      map.addLayer(clusterGroup);
      clusterGroupRef.current = clusterGroup;

      const supplyLayer = L.layerGroup();
      map.addLayer(supplyLayer);
      supplyLayerRef.current = supplyLayer;

      setStatus('ready');

      // Initial pings are loaded by MapShell (fetchPings — no bounds).
      // Subsequent pan/zoom uses debouncedFetchInBounds for spatial filtering.
    } catch (err) {
      setStatus('error');
      setErrorMsg(String(err));
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Switch tile layer on theme change ───
  useEffect(() => {
    if (!mapRef.current || !tileRef.current) return;
    const newUrl = isDark ? DARK_TILES : LIGHT_TILES;
    tileRef.current.setUrl(newUrl);
  }, [isDark]);

  // ─── Sync center when store changes externally ───
  const syncCenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    if (Math.abs(c.lat - center.lat) > 0.001 || Math.abs(c.lng - center.lng) > 0.001) {
      map.panTo([center.lat, center.lng]);
    }
  }, [center]);

  useEffect(() => { syncCenter(); }, [syncCenter]);

  // ─── Handle flyTo requests from other components ───
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToTarget) return;
    map.flyTo([flyToTarget.lat, flyToTarget.lng], flyToTarget.zoom ?? map.getZoom(), { duration: 1.2 });
    setFlyTo(null);
  }, [flyToTarget, setFlyTo]);

  // ─── SOS draft marker (red pin when SOS form is open) ───
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (sosDraftLocation) {
      const icon = L.divIcon({
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        html: `<div class="sos-draft-pin"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#ef4444" stroke="#fff" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg></div>`,
      });

      if (sosDraftMarkerRef.current) {
        sosDraftMarkerRef.current.setLatLng([sosDraftLocation.lat, sosDraftLocation.lng]);
        sosDraftMarkerRef.current.setIcon(icon);
      } else {
        const marker = L.marker([sosDraftLocation.lat, sosDraftLocation.lng], {
          icon,
          interactive: false,
          zIndexOffset: 1000,
        }).addTo(map);
        sosDraftMarkerRef.current = marker;
      }
    } else {
      if (sosDraftMarkerRef.current) {
        sosDraftMarkerRef.current.remove();
        sosDraftMarkerRef.current = null;
      }
    }
  }, [sosDraftLocation]);

  // ─── Manage ping markers (with clustering) ───
  // Track ping data by ID for fast lookup in selection effect
  const pingDataRef = useRef<Map<string, PingData>>(new Map());
  const prevSelectedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mapRef.current || !clusterGroupRef.current || status !== 'ready') return;
    const clusterGroup = clusterGroupRef.current;
    const cur = markersRef.current;
    const activeIds = new Set(filteredPings.map((p) => p.id));

    // Update ping data lookup
    const dataMap = pingDataRef.current;
    dataMap.clear();
    for (const p of filteredPings) dataMap.set(p.id, p);

    // Remove stale markers
    const toRemove: string[] = [];
    for (const [id] of cur) {
      if (!activeIds.has(id)) toRemove.push(id);
    }
    for (const id of toRemove) {
      const marker = cur.get(id);
      if (marker) {
        clusterGroup.removeLayer(marker);
        cur.delete(id);
      }
    }

    // Add or update markers (non-selected state — selection handled separately)
    for (const ping of filteredPings) {
      const existing = cur.get(ping.id);
      const isSelected = selectedPingId === ping.id;

      if (existing) {
        existing.setIcon(createPingIcon(ping, isSelected));
      } else {
        const marker = L.marker([ping.lat, ping.lng], {
          icon: createPingIcon(ping, isSelected),
          interactive: true,
        });
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          selectPing(ping.id);
        });
        clusterGroup.addLayer(marker);
        cur.set(ping.id, marker);
      }
    }
  }, [filteredPings, selectPing, status]); // Note: selectedPingId removed

  // ─── Selection highlight (only updates 2 markers, not all) ───
  useEffect(() => {
    const cur = markersRef.current;
    const dataMap = pingDataRef.current;
    const prevId = prevSelectedRef.current;

    // Deselect previously selected marker
    if (prevId && prevId !== selectedPingId) {
      const prevMarker = cur.get(prevId);
      const prevPing = dataMap.get(prevId);
      if (prevMarker && prevPing) {
        prevMarker.setIcon(createPingIcon(prevPing, false));
      }
    }

    // Select new marker
    if (selectedPingId) {
      const newMarker = cur.get(selectedPingId);
      const newPing = dataMap.get(selectedPingId);
      if (newMarker && newPing) {
        newMarker.setIcon(createPingIcon(newPing, true));
      }
    }

    prevSelectedRef.current = selectedPingId;
  }, [selectedPingId]);

  // ─── Zone polygon rendering ───
  useEffect(() => {
    for (const poly of zoneLayersRef.current) poly.remove();
    zoneLayersRef.current = [];

    if (!mapRef.current || status !== 'ready' || !showZones) return;
    const map = mapRef.current;

    for (const zone of zones) {
      if (zone.boundary.length < 3) continue;
      const color = ZONE_COLORS[zone.riskLevel] || ZONE_COLORS[3];
      const isHighRisk = zone.riskLevel >= 4;
      const latLngs: L.LatLngExpression[] = zone.boundary.map((b) => [b.lat, b.lng]);

      const polygon = L.polygon(latLngs, {
        color: isHighRisk ? '#ef4444' : color,
        weight: isHighRisk ? 3 : 2,
        opacity: isHighRisk ? 1 : 0.8,
        fillColor: color,
        fillOpacity: isDark ? (isHighRisk ? 0.25 : 0.2) : (isHighRisk ? 0.2 : 0.15),
        dashArray: isHighRisk ? undefined : '6, 4',
      });

      polygon.bindPopup(
        `<div style="font-family:Inter,sans-serif;padding:2px 4px">
          <strong>${zone.name}</strong><br/>
          <span style="color:${color}">Mức độ rủi ro: ${zone.riskLevel}/5</span>
        </div>`,
      );

      polygon.addTo(map);
      zoneLayersRef.current.push(polygon);
    }
  }, [zones, showZones, status, isDark]);

  // ─── Fetch supply items on mount ───
  useEffect(() => {
    if (status === 'ready') {
      fetchSupplyItems();
    }
  }, [status, fetchSupplyItems]);

  // ─── Supply point markers ───
  useEffect(() => {
    const layer = supplyLayerRef.current;
    if (!layer || !mapRef.current || status !== 'ready') return;

    const cur = supplyMarkersRef.current;

    if (!showSupplyPoints) {
      // Hide all supply markers
      for (const [, marker] of cur) layer.removeLayer(marker);
      cur.clear();
      return;
    }

    const activeIds = new Set(supplyItems.map((s) => s.id));

    // Remove stale markers
    for (const [id, marker] of cur) {
      if (!activeIds.has(id)) {
        layer.removeLayer(marker);
        cur.delete(id);
      }
    }

    // Add or update markers
    for (const supply of supplyItems) {
      const existing = cur.get(supply.id);
      if (existing) {
        existing.setIcon(createSupplyIcon(supply));
      } else {
        const marker = L.marker([supply.lat, supply.lng], {
          icon: createSupplyIcon(supply),
          interactive: true,
        });
        marker.bindPopup(
          `<div style="font-family:Inter,sans-serif;padding:2px 4px">
            <strong>${supply.name}</strong><br/>
            <span style="color:var(--text-secondary)">Số lượng: ${supply.quantity}</span><br/>
            <span style="font-size:0.8em;color:#6b7280">${supply.lat.toFixed(4)}, ${supply.lng.toFixed(4)}</span>
          </div>`
        );
        layer.addLayer(marker);
        cur.set(supply.id, marker);
      }
    }
  }, [supplyItems, showSupplyPoints, status]);

  // ─── Route polyline rendering ───
  useEffect(() => {
    // Clean up previous route layers
    for (const line of routeLayersRef.current) line.remove();
    routeLayersRef.current = [];
    for (const marker of routeMarkersRef.current) marker.remove();
    routeMarkersRef.current = [];

    if (!mapRef.current || status !== 'ready' || !route) return;
    const map = mapRef.current;

    const altColors = [
      isDark ? '#a78bfa' : '#7c3aed', // Alt 1: purple
      isDark ? '#34d399' : '#059669', // Alt 2: green
    ];

    const routeEntries = [
      {
        index: 0,
        coordinates: route.coordinates,
        color: isDark ? '#60a5fa' : '#2563eb',
      },
      ...route.alternatives.map((alt, idx) => ({
        index: idx + 1,
        coordinates: alt.coordinates,
        color: altColors[idx] || (isDark ? '#6b7280' : '#9ca3af'),
      })),
    ];

    const orderedEntries = [
      ...routeEntries.filter((entry) => entry.index !== route.selectedIndex),
      ...routeEntries.filter((entry) => entry.index === route.selectedIndex),
    ];

    for (const entry of orderedEntries) {
      if (entry.coordinates.length <= 1) continue;
      const isSelected = route.selectedIndex === entry.index;
      const polyline = L.polyline(entry.coordinates, {
        color: entry.color,
        weight: isSelected ? 6 : 5,
        opacity: isSelected ? 0.88 : 0.65,
        dashArray: isSelected ? undefined : '12, 8',
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
      polyline.on('click', () => {
        const { selectRouteIndex } = useMapStore.getState();
        selectRouteIndex(entry.index);
      });
      routeLayersRef.current.push(polyline);
    }

    const allCoordinates = routeEntries.flatMap((entry) => entry.coordinates);
    if (allCoordinates.length > 1) {
      const fitPolyline = L.polyline(allCoordinates);
      map.fitBounds(fitPolyline.getBounds(), { padding: [60, 60] });
    }

    // Origin marker (blue circle — user's location)
    const originMarker = L.circleMarker([route.origin.lat, route.origin.lng], {
      radius: 8,
      fillColor: '#3b82f6',
      fillOpacity: 1,
      color: '#ffffff',
      weight: 3,
    }).addTo(map);
    originMarker.bindPopup('<strong>Vị trí của bạn</strong>');
    routeMarkersRef.current.push(originMarker);

    // Destination marker (red circle)
    const destMarker = L.circleMarker([route.destination.lat, route.destination.lng], {
      radius: 8,
      fillColor: '#ef4444',
      fillOpacity: 1,
      color: '#ffffff',
      weight: 3,
    }).addTo(map);
    routeMarkersRef.current.push(destMarker);
  }, [route, status, isDark]);

  // ─── Vietnam territory boundary line (removed by design) ───
  useEffect(() => {
    if (territoryLineRef.current) { territoryLineRef.current.remove(); territoryLineRef.current = null; }
  }, [status, isDark]);

  // ─── Hoang Sa & Truong Sa island markers ───
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready') return;

    // Only show Paracel & Spratly (first 2 entries)
    const islands = ISLAND_ZONES.filter((z) => z.name === 'Paracel Islands' || z.name === 'Spratly Islands');

    // Create markers if not yet created
    if (islandMarkersRef.current.length === 0) {
      for (const island of islands) {
        const icon = L.divIcon({
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          html: `<div style="width:32px;height:32px;border-radius:50%;background:#dc2626;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:pointer;border:2px solid rgba(255,255,255,0.9)"><svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='#facc15' stroke='#facc15' stroke-width='0'><polygon points='12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26'/></svg></div>`,
        });

        const marker = L.marker([island.center.lat, island.center.lng], { icon, interactive: true })
          .bindPopup(
            `<div style="font-family:Inter,sans-serif;padding:4px 2px;min-width:140px">
              <strong>${island.nameVi}</strong><br/>
              <span style="font-size:0.85em;color:#6b7280">${island.name}</span><br/>
              <span style="font-size:0.8em;color:#3b82f6">Lãnh thổ Việt Nam 🇻🇳</span>
            </div>`,
            { closeButton: false }
          );

        marker.on('click', () => {
          map.flyTo([island.center.lat, island.center.lng], 8, { duration: 1.2 });
        });

        marker.addTo(map);
        islandMarkersRef.current.push(marker);
      }
    }

    // Show/hide based on zoom level
    const updateVisibility = () => {
      const currentZoom = map.getZoom();
      for (const m of islandMarkersRef.current) {
        if (currentZoom >= 8) {
          m.setOpacity(0);
          m.closePopup();
        } else {
          m.setOpacity(1);
        }
      }
    };

    updateVisibility();
    map.on('zoomend', updateVisibility);
    return () => { map.off('zoomend', updateVisibility); };
  }, [status]);

  // ─── Cleanup on unmount ───
  useEffect(() => {
    return () => {
      if (clusterGroupRef.current) {
        clusterGroupRef.current.clearLayers();
        clusterGroupRef.current = null;
      }
      for (const marker of markersRef.current.values()) marker.remove();
      markersRef.current.clear();
      for (const poly of zoneLayersRef.current) poly.remove();
      zoneLayersRef.current = [];
      for (const line of routeLayersRef.current) line.remove();
      routeLayersRef.current = [];
      for (const marker of routeMarkersRef.current) marker.remove();
      routeMarkersRef.current = [];
      if (supplyLayerRef.current) {
        supplyLayerRef.current.clearLayers();
        supplyLayerRef.current = null;
      }
      for (const marker of supplyMarkersRef.current.values()) marker.remove();
      supplyMarkersRef.current.clear();
      for (const marker of islandMarkersRef.current) marker.remove();
      islandMarkersRef.current = [];
      if (territoryLineRef.current) { territoryLineRef.current.remove(); territoryLineRef.current = null; }
    };
  }, []);

  // ─── Error state ───
  if (status === 'error') {
    return (
      <div className="map-fallback">
        <AlertCircle size={48} strokeWidth={1.5} style={{ color: 'var(--color-danger)' }} />
        <h3>{t('map.loadError')}</h3>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', maxWidth: 360 }}>
          {t('map.loadErrorDesc')}
        </p>
        <p style={{ fontSize: 'var(--text-xs)', opacity: 0.5 }}>{errorMsg}</p>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => window.location.reload()}
          style={{ marginTop: 'var(--sp-2)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}
        >
          <RefreshCw size={14} /> {t('map.retry')}
        </button>
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {status === 'loading' && (
        <div className="map-fallback" style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          <div className="spinner spinner-lg" />
          <p>{t('map.loading')}</p>
        </div>
      )}
    </>
  );
}
