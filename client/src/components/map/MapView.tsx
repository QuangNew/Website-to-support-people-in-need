import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useMapStore, type PingData, type PingType } from '../../stores/mapStore';
import { useTheme } from '../../contexts/ThemeContext';

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

/** Create a Leaflet DivIcon for a ping marker */
function createPingIcon(ping: PingData, isSelected: boolean): L.DivIcon {
  const color = PING_COLORS[ping.type];
  const svg = PING_SVGS[ping.type];
  const isPulsing = ping.type === 'need_help' && ping.status === 'active';
  return L.divIcon({
    className: '', // no default leaflet icon styles
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `<button class="map-marker ${isSelected ? 'map-marker-selected' : ''} ${isPulsing ? 'map-marker-pulse' : ''}" style="background-color:${color}" aria-label="${ping.title}">${svg}</button>`,
  });
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
  } = useMapStore();
  const { isDark } = useTheme();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const zoneLayersRef = useRef<L.Polygon[]>([]);
  const routeLayersRef = useRef<L.Polyline[]>([]);
  const routeMarkersRef = useRef<L.CircleMarker[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const filteredPings = useMemo(
    () => pings.filter((p) => activeFilters.includes(p.type)),
    [pings, activeFilters],
  );

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

      // Sync store on user interaction
      map.on('moveend', () => {
        const c = map.getCenter();
        setCenter({ lat: c.lat, lng: c.lng });
      });
      map.on('zoomend', () => {
        setZoom(map.getZoom());
      });
      map.on('click', () => {
        selectPing(null);
      });

      mapRef.current = map;
      tileRef.current = tile;

      // Create marker cluster group
      const clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        disableClusteringAtZoom: 16,
      });
      map.addLayer(clusterGroup);
      clusterGroupRef.current = clusterGroup;

      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setErrorMsg(String(err));
    }

    return () => {
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

  // ─── Manage ping markers (with clustering) ───
  useEffect(() => {
    if (!mapRef.current || !clusterGroupRef.current || status !== 'ready') return;
    const clusterGroup = clusterGroupRef.current;
    const cur = markersRef.current;
    const activeIds = new Set(filteredPings.map((p) => p.id));

    // Remove stale markers
    for (const [id, marker] of cur) {
      if (!activeIds.has(id)) {
        clusterGroup.removeLayer(marker);
        cur.delete(id);
      }
    }

    // Add or update markers
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
  }, [filteredPings, selectedPingId, selectPing, status]);

  // ─── Zone polygon rendering ───
  useEffect(() => {
    for (const poly of zoneLayersRef.current) poly.remove();
    zoneLayersRef.current = [];

    if (!mapRef.current || status !== 'ready' || !showZones) return;
    const map = mapRef.current;

    for (const zone of zones) {
      if (zone.boundary.length < 3) continue;
      const color = ZONE_COLORS[zone.riskLevel] || ZONE_COLORS[3];
      const latLngs: L.LatLngExpression[] = zone.boundary.map((b) => [b.lat, b.lng]);

      const polygon = L.polygon(latLngs, {
        color,
        weight: 2,
        opacity: 0.8,
        fillColor: color,
        fillOpacity: isDark ? 0.2 : 0.15,
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

  // ─── Route polyline rendering ───
  useEffect(() => {
    // Clean up previous route layers
    for (const line of routeLayersRef.current) line.remove();
    routeLayersRef.current = [];
    for (const marker of routeMarkersRef.current) marker.remove();
    routeMarkersRef.current = [];

    if (!mapRef.current || status !== 'ready' || !route) return;
    const map = mapRef.current;

    // Draw alternative route first (underneath, gray dashed)
    if (route.alternative && route.alternative.length > 1) {
      const altPolyline = L.polyline(route.alternative, {
        color: isDark ? '#6b7280' : '#9ca3af',
        weight: 5,
        opacity: 0.5,
        dashArray: '10, 8',
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
      routeLayersRef.current.push(altPolyline);
    }

    // Draw primary route (blue, solid)
    if (route.coordinates.length > 1) {
      const primaryPolyline = L.polyline(route.coordinates, {
        color: isDark ? '#60a5fa' : '#2563eb',
        weight: 5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
      routeLayersRef.current.push(primaryPolyline);

      // Fit map to route bounds with padding
      const bounds = primaryPolyline.getBounds();
      map.fitBounds(bounds, { padding: [60, 60] });
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
    };
  }, []);

  // ─── Error state ───
  if (status === 'error') {
    return (
      <div className="map-fallback">
        <AlertCircle size={48} strokeWidth={1.5} style={{ color: 'var(--color-danger)' }} />
        <h3>Không thể tải bản đồ</h3>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', maxWidth: 360 }}>
          Đã xảy ra lỗi khi khởi tạo bản đồ OpenStreetMap. Kiểm tra kết nối mạng và thử lại.
        </p>
        <p style={{ fontSize: 'var(--text-xs)', opacity: 0.5 }}>{errorMsg}</p>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => window.location.reload()}
          style={{ marginTop: 'var(--sp-2)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}
        >
          <RefreshCw size={14} /> Thử lại
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
          <p>Đang tải bản đồ...</p>
        </div>
      )}
    </>
  );
}
