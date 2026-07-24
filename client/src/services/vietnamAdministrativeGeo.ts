import type {
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Polygon,
  Position,
} from 'geojson';

export const VIETNAM_ADMINISTRATIVE_DATASET = {
  repository: 'https://github.com/thanglequoc/vietnamese-provinces-database',
  commit: 'd10fd83c4bf7a5839a56706f1c04f13133271cfc',
  version: 'v4.1.0',
} as const;

const CATALOG_URL = '/data/vietnam-administrative-units.json';
const GEOJSON_BASE_URL =
  `https://raw.githubusercontent.com/thanglequoc/vietnamese-provinces-database/` +
  `${VIETNAM_ADMINISTRATIVE_DATASET.commit}/json/geojson`;

export interface VietnamAdministrativeWard {
  Code: string;
  FullName: string;
  ProvinceCode: string;
}

export interface VietnamAdministrativeProvince {
  Code: string;
  FullName: string;
  Wards: VietnamAdministrativeWard[];
}

export interface AdministrativeBoundarySelection {
  level: 'province' | 'ward';
  name: string;
  provinceCode: string;
  wardCode?: string;
  geometry: Polygon | MultiPolygon;
  representativePoint: { lat: number; lng: number };
  sourceUrl: string;
}

type AdministrativeBoundaryFile =
  FeatureCollection<Polygon | MultiPolygon, Record<string, unknown>>;

let catalogPromise: Promise<VietnamAdministrativeProvince[]> | null = null;

function removeAdministrativePrefix(fullName: string): string {
  return fullName.replace(/^(Thành phố|Tỉnh|Phường|Xã|Đặc khu)\s+/u, '');
}

export function toAdministrativeCodeName(fullName: string): string {
  return removeAdministrativePrefix(fullName)
    .replace(/[Đđ]/g, (character) => (character === 'Đ' ? 'D' : 'd'))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

export async function loadVietnamAdministrativeCatalog(): Promise<VietnamAdministrativeProvince[]> {
  if (!catalogPromise) {
    catalogPromise = fetch(CATALOG_URL)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Không thể tải danh mục địa giới (${response.status}).`);
        }

        const catalog = await response.json() as unknown;
        if (!Array.isArray(catalog) || catalog.length !== 34) {
          throw new Error('Danh mục địa giới Việt Nam không đúng định dạng.');
        }

        return catalog as VietnamAdministrativeProvince[];
      })
      .catch((error) => {
        catalogPromise = null;
        throw error;
      });
  }

  return catalogPromise;
}

function buildBoundaryUrl(
  province: VietnamAdministrativeProvince,
  ward?: VietnamAdministrativeWard,
): string {
  const provinceFileName = `${province.Code}_${toAdministrativeCodeName(province.FullName)}`;
  const unitFileName = ward
    ? `wards/${ward.Code}_${toAdministrativeCodeName(ward.FullName)}.geojson`
    : `${provinceFileName}.geojson`;

  return `${GEOJSON_BASE_URL}/${provinceFileName}/${unitFileName}`;
}

function isBoundaryGeometry(geometry: Geometry | null): geometry is Polygon | MultiPolygon {
  return geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon';
}

export function parseBoundaryGeometry(value: string): Polygon | MultiPolygon | null {
  if (!value.trim()) return null;

  try {
    const parsed = JSON.parse(value) as
      | Geometry
      | { type?: string; geometry?: Geometry | null; features?: Array<{ geometry?: Geometry | null }> };

    if (isBoundaryGeometry(parsed as Geometry)) {
      return parsed as Polygon | MultiPolygon;
    }

    const container = parsed as {
      type?: string;
      geometry?: Geometry | null;
      features?: Array<{ geometry?: Geometry | null }>;
    };
    const featureGeometry = container.geometry ?? null;
    if (container.type === 'Feature' && isBoundaryGeometry(featureGeometry)) {
      return featureGeometry;
    }

    const collectionGeometry = container.features?.[0]?.geometry ?? null;
    if (
      container.type === 'FeatureCollection'
      && Array.isArray(container.features)
      && isBoundaryGeometry(collectionGeometry)
    ) {
      return collectionGeometry;
    }
  } catch {
    return null;
  }

  return null;
}

function ringSignedArea(ring: Position[]): number {
  let sum = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index];
    const next = ring[index + 1];
    if (!current || !next) continue;
    sum += current[0] * next[1] - next[0] * current[1];
  }
  return sum / 2;
}

function ringCentroid(ring: Position[]): { lat: number; lng: number } | null {
  const signedArea = ringSignedArea(ring);
  if (Math.abs(signedArea) < Number.EPSILON) return null;

  let lngSum = 0;
  let latSum = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index];
    const next = ring[index + 1];
    if (!current || !next) continue;
    const cross = current[0] * next[1] - next[0] * current[1];
    lngSum += (current[0] + next[0]) * cross;
    latSum += (current[1] + next[1]) * cross;
  }

  return {
    lng: lngSum / (6 * signedArea),
    lat: latSum / (6 * signedArea),
  };
}

function pointInRing(point: { lat: number; lng: number }, ring: Position[]): boolean {
  let inside = false;
  for (let currentIndex = 0, previousIndex = ring.length - 1; currentIndex < ring.length; previousIndex = currentIndex, currentIndex += 1) {
    const current = ring[currentIndex];
    const previous = ring[previousIndex];
    if (!current || !previous) continue;

    const intersects =
      (current[1] > point.lat) !== (previous[1] > point.lat)
      && point.lng
        < ((previous[0] - current[0]) * (point.lat - current[1]))
          / (previous[1] - current[1])
          + current[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygonCoordinates(
  point: { lat: number; lng: number },
  coordinates: Position[][],
): boolean {
  const outerRing = coordinates[0];
  if (!outerRing || !pointInRing(point, outerRing)) return false;
  return coordinates.slice(1).every((hole) => !pointInRing(point, hole));
}

export function isPointInsideBoundary(
  point: { lat: number; lng: number },
  geometry: Polygon | MultiPolygon,
): boolean {
  if (geometry.type === 'Polygon') {
    return pointInPolygonCoordinates(point, geometry.coordinates);
  }

  return geometry.coordinates.some((polygon) => pointInPolygonCoordinates(point, polygon));
}

function largestPolygonCoordinates(geometry: Polygon | MultiPolygon): Position[][] {
  if (geometry.type === 'Polygon') return geometry.coordinates;

  return geometry.coordinates.reduce((largest, candidate) => {
    const largestArea = Math.abs(ringSignedArea(largest[0] ?? []));
    const candidateArea = Math.abs(ringSignedArea(candidate[0] ?? []));
    return candidateArea > largestArea ? candidate : largest;
  }, geometry.coordinates[0] ?? []);
}

function getRepresentativePoint(geometry: Polygon | MultiPolygon): { lat: number; lng: number } {
  const polygon = largestPolygonCoordinates(geometry);
  const outerRing = polygon[0] ?? [];
  const centroid = ringCentroid(outerRing);
  if (centroid && pointInPolygonCoordinates(centroid, polygon)) return centroid;

  const lngValues = outerRing.map((position) => position[0]);
  const latValues = outerRing.map((position) => position[1]);
  const west = Math.min(...lngValues);
  const east = Math.max(...lngValues);
  const south = Math.min(...latValues);
  const north = Math.max(...latValues);
  const boundsCenter = { lat: (south + north) / 2, lng: (west + east) / 2 };
  if (pointInPolygonCoordinates(boundsCenter, polygon)) return boundsCenter;

  for (let row = 1; row < 10; row += 1) {
    for (let column = 1; column < 10; column += 1) {
      const candidate = {
        lat: south + ((north - south) * row) / 10,
        lng: west + ((east - west) * column) / 10,
      };
      if (pointInPolygonCoordinates(candidate, polygon)) return candidate;
    }
  }

  const fallback = outerRing[0];
  if (!fallback) throw new Error('Địa giới không chứa tọa độ hợp lệ.');
  return { lat: fallback[1], lng: fallback[0] };
}

export async function loadAdministrativeBoundary(
  province: VietnamAdministrativeProvince,
  ward?: VietnamAdministrativeWard,
  signal?: AbortSignal,
): Promise<AdministrativeBoundarySelection> {
  const sourceUrl = buildBoundaryUrl(province, ward);
  const response = await fetch(sourceUrl, { signal });
  if (!response.ok) {
    throw new Error(`Không thể tải GeoJSON địa giới (${response.status}).`);
  }

  const boundary = await response.json() as AdministrativeBoundaryFile;
  const geometry = boundary.features?.[0]?.geometry ?? null;
  if (boundary.type !== 'FeatureCollection' || !isBoundaryGeometry(geometry)) {
    throw new Error('GeoJSON địa giới không chứa Polygon/MultiPolygon hợp lệ.');
  }

  return {
    level: ward ? 'ward' : 'province',
    name: ward?.FullName ?? province.FullName,
    provinceCode: province.Code,
    wardCode: ward?.Code,
    geometry,
    representativePoint: getRepresentativePoint(geometry),
    sourceUrl,
  };
}
