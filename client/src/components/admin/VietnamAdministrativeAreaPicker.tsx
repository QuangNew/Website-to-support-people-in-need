import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import '@maplibre/maplibre-gl-leaflet';
import 'leaflet/dist/leaflet.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { AlertCircle, Database, LoaderCircle, MapPin } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { loadVietnamBasemapStyle } from '../map/vietnamBasemapStyle';
import {
  VIETNAM_ADMINISTRATIVE_DATASET,
  isPointInsideBoundary,
  loadAdministrativeBoundary,
  loadVietnamAdministrativeCatalog,
  parseBoundaryGeometry,
  type AdministrativeBoundarySelection,
  type VietnamAdministrativeProvince,
} from '../../services/vietnamAdministrativeGeo';

interface VietnamAdministrativeAreaPickerProps {
  boundaryGeoJson?: string;
  point?: { lat: number; lng: number } | null;
  onAreaSelected: (selection: AdministrativeBoundarySelection) => void;
  onPointChange?: (point: { lat: number; lng: number }) => void;
  disabled?: boolean;
}

export default function VietnamAdministrativeAreaPicker({
  boundaryGeoJson,
  point = null,
  onAreaSelected,
  onPointChange,
  disabled = false,
}: VietnamAdministrativeAreaPickerProps) {
  const { isDark } = useTheme();
  const [catalog, setCatalog] = useState<VietnamAdministrativeProvince[]>([]);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState('');
  const [selectedWardCode, setSelectedWardCode] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [boundaryLoading, setBoundaryLoading] = useState(false);
  const [error, setError] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [loadedGeometry, setLoadedGeometry] = useState<AdministrativeBoundarySelection['geometry'] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const basemapRef = useRef<L.MaplibreGL | null>(null);
  const boundaryLayerRef = useRef<L.GeoJSON | null>(null);
  const pointLayerRef = useRef<L.CircleMarker | null>(null);
  const boundaryRequestRef = useRef<AbortController | null>(null);
  const pointChangeRef = useRef(onPointChange);
  const suppliedGeometry = useMemo(
    () => parseBoundaryGeometry(boundaryGeoJson ?? ''),
    [boundaryGeoJson],
  );
  const geometry = boundaryGeoJson === undefined ? loadedGeometry : suppliedGeometry;
  const geometryRef = useRef(geometry);

  const selectedProvince = useMemo(
    () => catalog.find((province) => province.Code === selectedProvinceCode) ?? null,
    [catalog, selectedProvinceCode],
  );

  useEffect(() => {
    pointChangeRef.current = onPointChange;
  }, [onPointChange]);

  useEffect(() => {
    geometryRef.current = geometry;
  }, [geometry]);

  useEffect(() => {
    let active = true;
    loadVietnamAdministrativeCatalog()
      .then((data) => {
        if (active) setCatalog(data);
      })
      .catch((catalogError: unknown) => {
        if (active) {
          setError(catalogError instanceof Error ? catalogError.message : 'Không thể tải danh mục địa giới.');
        }
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [15.8, 106.6],
      zoom: 5,
      minZoom: 4,
      maxZoom: 18,
      zoomControl: true,
    });
    mapRef.current = map;

    map.on('click', (event) => {
      const changePoint = pointChangeRef.current;
      if (!changePoint) return;

      const candidate = { lat: event.latlng.lat, lng: event.latlng.lng };
      const currentGeometry = geometryRef.current;
      if (currentGeometry && !isPointInsideBoundary(candidate, currentGeometry)) {
        setError('Hãy chọn một điểm nằm bên trong địa giới đang hiển thị.');
        return;
      }

      setError('');
      changePoint(candidate);
    });

    window.setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
      basemapRef.current = null;
      boundaryLayerRef.current = null;
      pointLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const controller = new AbortController();
    basemapRef.current?.remove();
    basemapRef.current = null;

    loadVietnamBasemapStyle(isDark, controller.signal)
      .then((style) => {
        if (controller.signal.aborted || !mapRef.current) return;
        const layer = L.maplibreGL({ style });
        layer.addTo(map);
        basemapRef.current = layer;
        boundaryLayerRef.current?.bringToFront();
        pointLayerRef.current?.bringToFront();
      })
      .catch((styleError: unknown) => {
        if (!controller.signal.aborted) {
          console.warn('[AdminBoundaryPicker] Basemap unavailable:', styleError);
        }
      });

    return () => controller.abort();
  }, [isDark]);

  useEffect(() => {
    const map = mapRef.current;
    boundaryLayerRef.current?.remove();
    boundaryLayerRef.current = null;
    if (!map || !geometry) return;

    const layer = L.geoJSON(geometry, {
      style: {
        color: '#dc2626',
        fillColor: '#ef4444',
        fillOpacity: 0.18,
        weight: 2,
      },
    }).addTo(map);
    boundaryLayerRef.current = layer;

    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 13 });
    }
    window.setTimeout(() => map.invalidateSize(), 0);
  }, [geometry]);

  useEffect(() => {
    const map = mapRef.current;
    pointLayerRef.current?.remove();
    pointLayerRef.current = null;
    if (!map || !point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return;

    const marker = L.circleMarker([point.lat, point.lng], {
      radius: 8,
      color: '#fff',
      fillColor: '#2563eb',
      fillOpacity: 1,
      weight: 3,
    }).addTo(map);
    pointLayerRef.current = marker;
    marker.bringToFront();

    if (!geometry) {
      map.setView([point.lat, point.lng], Math.max(map.getZoom(), 12));
    }
  }, [geometry, point]);

  useEffect(() => () => boundaryRequestRef.current?.abort(), []);

  const selectBoundary = async (
    province: VietnamAdministrativeProvince,
    wardCode?: string,
  ) => {
    const ward = wardCode
      ? province.Wards.find((candidate) => candidate.Code === wardCode)
      : undefined;
    if (wardCode && !ward) return;

    boundaryRequestRef.current?.abort();
    const controller = new AbortController();
    boundaryRequestRef.current = controller;
    setBoundaryLoading(true);
    setError('');

    try {
      const selection = await loadAdministrativeBoundary(province, ward, controller.signal);
      setSourceUrl(selection.sourceUrl);
      setLoadedGeometry(selection.geometry);
      onAreaSelected(selection);
    } catch (boundaryError) {
      if (!controller.signal.aborted) {
        setError(
          boundaryError instanceof Error
            ? boundaryError.message
            : 'Không thể tải GeoJSON địa giới.',
        );
      }
    } finally {
      if (boundaryRequestRef.current === controller) {
        boundaryRequestRef.current = null;
        setBoundaryLoading(false);
      }
    }
  };

  const handleProvinceChange = (provinceCode: string) => {
    setSelectedProvinceCode(provinceCode);
    setSelectedWardCode('');
    setSourceUrl('');
    const province = catalog.find((candidate) => candidate.Code === provinceCode);
    if (province) void selectBoundary(province);
  };

  const handleWardChange = (wardCode: string) => {
    setSelectedWardCode(wardCode);
    if (selectedProvince) void selectBoundary(selectedProvince, wardCode || undefined);
  };

  return (
    <div className="admin-geo-picker">
      <div className="admin-geo-picker__selectors">
        <label>
          <span>Tỉnh / thành phố</span>
          <select
            className="admin-select"
            aria-label="Tỉnh hoặc thành phố"
            value={selectedProvinceCode}
            onChange={(event) => handleProvinceChange(event.target.value)}
            disabled={disabled || catalogLoading}
          >
            <option value="">
              {catalogLoading ? 'Đang tải danh mục…' : '— Chọn tỉnh/thành —'}
            </option>
            {catalog.map((province) => (
              <option key={province.Code} value={province.Code}>
                {province.Code} — {province.FullName}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Phường / xã / đặc khu (không bắt buộc)</span>
          <select
            className="admin-select"
            aria-label="Phường xã hoặc đặc khu"
            value={selectedWardCode}
            onChange={(event) => handleWardChange(event.target.value)}
            disabled={disabled || !selectedProvince || boundaryLoading}
          >
            <option value="">— Dùng toàn bộ tỉnh/thành —</option>
            {selectedProvince?.Wards.map((ward) => (
              <option key={ward.Code} value={ward.Code}>
                {ward.Code} — {ward.FullName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        ref={containerRef}
        className={`admin-geo-picker__map${onPointChange ? ' admin-geo-picker__map--interactive' : ''}`}
        aria-label="Bản xem trước địa giới hành chính"
      />

      <div className="admin-geo-picker__status">
        {boundaryLoading ? (
          <span><LoaderCircle className="admin-geo-picker__spin" size={15} /> Đang tải GeoJSON chuẩn…</span>
        ) : onPointChange ? (
          <span><MapPin size={15} /> Bấm trên bản đồ để đặt chính xác vị trí điểm cung ứng.</span>
        ) : (
          <span><Database size={15} /> Chọn địa giới để tự điền tên và polygon.</span>
        )}
        <a
          href={sourceUrl || VIETNAM_ADMINISTRATIVE_DATASET.repository}
          target="_blank"
          rel="noreferrer"
        >
          Nguồn dữ liệu {VIETNAM_ADMINISTRATIVE_DATASET.version}
        </a>
      </div>

      {error && (
        <div className="admin-geo-picker__error" role="alert">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
