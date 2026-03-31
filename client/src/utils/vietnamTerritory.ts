/**
 * Vietnam Territory Validation
 *
 * Uses a simplified polygon (~60 vertices) that closely traces
 * Vietnam's actual mainland border + 12 nautical mile territorial sea buffer
 * (~0.22° outward on all coastal segments), plus rectangular zones for
 * the Paracel Islands (Hoang Sa) and Spratly Islands (Truong Sa).
 *
 * Ray-casting algorithm determines if a point is inside the polygon.
 */

// ── Simplified mainland Vietnam polygon WITH territorial waters (~12 nm buffer) ──
// Eastern coast / southern tip / Gulf of Thailand coast pushed ~0.22° seaward.
// Land borders (China, Laos, Cambodia) remain unchanged.
export const VIETNAM_MAINLAND_POLYGON: [number, number][] = [
  // ── Northern border with China (unchanged — land border) ──
  [23.39, 105.33],  // Ha Giang (northernmost)
  [23.08, 105.08],  // Lao Cai region
  [22.80, 104.37],  // Lai Chau
  [22.39, 103.62],  // NW corner near Dien Bien
  [22.50, 103.97],  // Near Sa Pa
  [22.81, 104.73],  // Along China border
  [23.05, 105.36],  // Ha Giang ridge
  [22.94, 106.06],  // Cao Bang
  [22.40, 106.60],  // Lang Son north
  [21.97, 106.73],  // Lang Son
  [21.65, 107.36],  // Quang Ninh north
  [21.47, 108.20],  // Mong Cai (NE coast, +0.22° sea buffer)

  // ── Eastern coastline + 12nm territorial sea (push lng +0.22°) ──
  [21.00, 107.52],  // Quang Ninh coast
  [20.86, 107.18],  // Hai Phong
  [20.43, 106.82],  // Thai Binh coast
  [20.25, 106.42],  // Nam Dinh coast
  [19.77, 106.27],  // Ninh Binh coast
  [19.37, 106.12],  // Thanh Hoa coast
  [18.68, 105.92],  // Nghe An coast (Vinh)
  [18.07, 106.50],  // Ha Tinh coast
  [17.47, 106.82],  // Quang Binh coast (Dong Hoi)
  [16.82, 107.32],  // Hue coast
  [16.07, 108.44],  // Da Nang
  [15.55, 108.82],  // Quang Nam coast (Hoi An)
  [15.12, 109.17],  // Quang Ngai coast
  [14.08, 109.52],  // Binh Dinh coast (Quy Nhon)
  [13.10, 109.52],  // Phu Yen coast (Tuy Hoa)
  [12.25, 109.42],  // Khanh Hoa coast (Nha Trang)
  [11.55, 109.23],  // Ninh Thuan coast (Phan Rang)
  [10.93, 108.52],  // Binh Thuan coast (Phan Thiet)
  [10.55, 107.74],  // Ba Ria - Vung Tau
  [10.33, 107.30],  // Vung Tau
  [10.00, 107.02],  // Southern coast
  [9.60,  106.64],  // Tra Vinh / Ben Tre coast
  [9.28,  106.32],  // Soc Trang coast
  [8.90,  105.72],  // Bac Lieu coast
  [8.36,  104.60],  // Ca Mau (southernmost tip, pushed south + slight west)

  // ── Gulf of Thailand / western coastline + 12nm buffer (push lng -0.22°) ──
  [9.28,  104.18],  // Ca Mau west coast
  [9.82,  104.53],  // Kien Giang south coast
  [10.02, 104.25],  // Ha Tien area
  [10.42, 104.28],  // Ha Tien

  // ── Western border with Cambodia (unchanged — land border) ──
  [10.60, 104.85],  // SW Cambodia border
  [10.85, 105.10],  // Chau Doc / An Giang
  [11.10, 105.57],  // Tay Ninh south
  [11.37, 106.02],  // Tay Ninh / HCMC west
  [11.60, 106.02],  // Binh Phuoc south

  // ── Western border with Cambodia / Laos (unchanged) ──
  [12.10, 106.50],  // Binh Phuoc
  [12.50, 107.00],  // Dak Nong
  [13.40, 107.20],  // Kon Tum south
  [14.40, 107.55],  // Kon Tum / Gia Lai border
  [14.95, 107.65],  // Quang Nam west

  // ── Western border with Laos (unchanged) ──
  [15.70, 107.40],  // Thua Thien Hue west
  [16.30, 106.55],  // Quang Tri / Laos border
  [17.10, 106.10],  // Ha Tinh / Laos border
  [17.80, 105.65],  // Nghe An / Laos border
  [18.50, 105.10],  // Nghe An west
  [19.00, 104.60],  // Thanh Hoa / Laos border
  [19.40, 104.05],  // Son La south
  [20.10, 103.70],  // Son La north
  [20.50, 103.20],  // Lai Chau south
  [20.90, 103.10],  // Lai Chau
  [21.50, 102.15],  // Dien Bien (westernmost)
  [21.75, 102.45],  // Dien Bien north
  [22.05, 102.88],  // Lao Cai SW
  [22.39, 103.62],  // Back to NW corner
];

// ── Island zone bounding boxes (include 12nm territorial sea buffer) ──
export interface IslandZone {
  name: string;
  nameVi: string;
  center: { lat: number; lng: number };
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}

export const ISLAND_ZONES: IslandZone[] = [
  {
    // Phú Lâm (Woody Island) at 16.8333°N, 112.3333°E
    // Archipelago spans ~15.7–17.1°N, 111.2–112.8°E + 0.22° territorial sea buffer
    name: 'Paracel Islands',
    nameVi: 'Quần đảo Hoàng Sa',
    center: { lat: 16.8333, lng: 112.3333 },
    bounds: {
      minLat: 15.48,
      maxLat: 17.37,
      minLng: 110.78,
      maxLng: 113.12,
    },
  },
  {
    // Trường Sa Lớn at 8.6333°N, 111.9167°E
    // Vietnam's claimed area in Spratlys + territorial waters
    name: 'Spratly Islands',
    nameVi: 'Quần đảo Trường Sa',
    center: { lat: 8.6333, lng: 111.9167 },
    bounds: {
      minLat: 5.78,
      maxLat: 12.20,
      minLng: 109.28,
      maxLng: 117.72,
    },
  },
  {
    // Con Dao archipelago + 12nm buffer
    name: 'Con Dao Islands',
    nameVi: 'Quần đảo Côn Đảo',
    center: { lat: 8.68, lng: 106.60 },
    bounds: {
      minLat: 8.33,
      maxLat: 9.07,
      minLng: 106.28,
      maxLng: 106.97,
    },
  },
  {
    // Phu Quoc island + 12nm buffer
    name: 'Phu Quoc Island',
    nameVi: 'Đảo Phú Quốc',
    center: { lat: 10.22, lng: 103.96 },
    bounds: {
      minLat: 9.68,
      maxLat: 10.72,
      minLng: 103.48,
      maxLng: 104.42,
    },
  },
];

/**
 * Ray-casting algorithm: determines if a point is inside a polygon.
 * Casts a ray from the point to the right and counts intersections.
 * Odd count = inside, even count = outside.
 */
function isPointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [yi, xi] = polygon[i]; // lat, lng
    const [yj, xj] = polygon[j];

    // Check if the ray intersects this edge
    if ((yi > lat) !== (yj > lat) &&
        lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Check if a point is within any island zone's bounding box.
 */
function isInIslandZone(lat: number, lng: number): boolean {
  return ISLAND_ZONES.some((zone) =>
    lat >= zone.bounds.minLat && lat <= zone.bounds.maxLat &&
    lng >= zone.bounds.minLng && lng <= zone.bounds.maxLng
  );
}

/**
 * Check if coordinates are within Vietnam territory (including territorial waters):
 * - Inside the mainland polygon (with 12nm sea buffer), OR
 * - Inside one of the island zones (Hoang Sa, Truong Sa, Con Dao, Phu Quoc)
 */
export function isInsideVietnam(lat: number, lng: number): boolean {
  return isPointInPolygon(lat, lng, VIETNAM_MAINLAND_POLYGON) || isInIslandZone(lat, lng);
}

/**
 * Outer bounding box that encompasses ALL Vietnam territory zones.
 * Used for quick rejection before polygon check.
 */
export const VN_OUTER_BOUNDS = {
  minLat: 5.78,    // Truong Sa southernmost (with buffer)
  maxLat: 23.39,   // Ha Giang northernmost
  minLng: 102.15,  // Dien Bien westernmost
  maxLng: 117.72,  // Truong Sa easternmost (with buffer)
};
