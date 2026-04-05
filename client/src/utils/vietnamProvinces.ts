/**
 * Vietnam Provinces / Cities — simplified boundary polygons.
 * Each entry has a name and a simplified GeoJSON Polygon (lat/lng pairs).
 * These are approximate administratve boundaries for zone creation.
 */

export interface ProvinceOption {
  name: string;
  nameVi: string;
  center: [number, number]; // [lat, lng]
  /** Simplified boundary as GeoJSON coordinates [[lng, lat], ...] */
  boundaryGeoJson: string;
}

// Helper to build a GeoJSON polygon from lat/lng pairs
function poly(coords: [number, number][]): string {
  // GeoJSON uses [lng, lat] order
  const ring = coords.map(([lat, lng]) => [lng, lat]);
  ring.push(ring[0]); // close ring
  return JSON.stringify({ type: 'Polygon', coordinates: [ring] });
}

export const VIETNAM_PROVINCES: ProvinceOption[] = [
  {
    name: 'Ha Noi',
    nameVi: 'Hà Nội',
    center: [21.03, 105.85],
    boundaryGeoJson: poly([
      [21.20, 105.55], [21.25, 105.70], [21.23, 105.90], [21.15, 106.02],
      [21.02, 106.05], [20.88, 105.98], [20.82, 105.78], [20.85, 105.60],
      [20.95, 105.50], [21.08, 105.48],
    ]),
  },
  {
    name: 'Ho Chi Minh City',
    nameVi: 'TP. Hồ Chí Minh',
    center: [10.82, 106.63],
    boundaryGeoJson: poly([
      [10.95, 106.50], [10.98, 106.65], [10.92, 106.82], [10.78, 106.85],
      [10.65, 106.78], [10.60, 106.62], [10.65, 106.48], [10.80, 106.42],
    ]),
  },
  {
    name: 'Da Nang',
    nameVi: 'Đà Nẵng',
    center: [16.05, 108.22],
    boundaryGeoJson: poly([
      [16.15, 108.08], [16.18, 108.22], [16.12, 108.35], [16.00, 108.38],
      [15.92, 108.28], [15.93, 108.12], [16.02, 108.05],
    ]),
  },
  {
    name: 'Hai Phong',
    nameVi: 'Hải Phòng',
    center: [20.86, 106.68],
    boundaryGeoJson: poly([
      [20.95, 106.52], [20.98, 106.70], [20.92, 106.85], [20.78, 106.88],
      [20.72, 106.75], [20.73, 106.55], [20.82, 106.48],
    ]),
  },
  {
    name: 'Can Tho',
    nameVi: 'Cần Thơ',
    center: [10.05, 105.75],
    boundaryGeoJson: poly([
      [10.15, 105.62], [10.18, 105.78], [10.10, 105.90], [9.95, 105.88],
      [9.90, 105.72], [9.95, 105.58], [10.05, 105.55],
    ]),
  },
  {
    name: 'Hue',
    nameVi: 'Thừa Thiên Huế',
    center: [16.47, 107.59],
    boundaryGeoJson: poly([
      [16.65, 107.25], [16.70, 107.55], [16.60, 107.85], [16.38, 107.95],
      [16.20, 107.78], [16.15, 107.48], [16.30, 107.20], [16.50, 107.15],
    ]),
  },
  {
    name: 'Quang Nam',
    nameVi: 'Quảng Nam',
    center: [15.57, 108.02],
    boundaryGeoJson: poly([
      [15.88, 107.50], [15.92, 107.85], [15.78, 108.30], [15.55, 108.55],
      [15.30, 108.45], [15.20, 108.10], [15.28, 107.65], [15.55, 107.38],
    ]),
  },
  {
    name: 'Quang Binh',
    nameVi: 'Quảng Bình',
    center: [17.47, 106.60],
    boundaryGeoJson: poly([
      [17.72, 106.05], [17.75, 106.40], [17.65, 106.80], [17.40, 106.95],
      [17.18, 106.75], [17.15, 106.38], [17.30, 106.02], [17.55, 105.95],
    ]),
  },
  {
    name: 'Nghe An',
    nameVi: 'Nghệ An',
    center: [19.00, 105.60],
    boundaryGeoJson: poly([
      [19.55, 104.60], [19.60, 105.30], [19.40, 105.85], [19.10, 106.10],
      [18.65, 105.95], [18.50, 105.30], [18.60, 104.70], [19.00, 104.40],
    ]),
  },
  {
    name: 'Khanh Hoa',
    nameVi: 'Khánh Hòa',
    center: [12.25, 109.20],
    boundaryGeoJson: poly([
      [12.60, 108.75], [12.65, 109.15], [12.48, 109.45], [12.20, 109.50],
      [11.95, 109.30], [11.90, 108.95], [12.05, 108.70], [12.35, 108.62],
    ]),
  },
  {
    name: 'Binh Dinh',
    nameVi: 'Bình Định',
    center: [13.77, 109.22],
    boundaryGeoJson: poly([
      [14.10, 108.80], [14.15, 109.15], [14.00, 109.50], [13.70, 109.55],
      [13.45, 109.35], [13.40, 108.98], [13.55, 108.72], [13.85, 108.65],
    ]),
  },
  {
    name: 'Thanh Hoa',
    nameVi: 'Thanh Hóa',
    center: [19.80, 105.78],
    boundaryGeoJson: poly([
      [20.20, 105.10], [20.25, 105.60], [20.10, 106.10], [19.75, 106.30],
      [19.40, 106.15], [19.35, 105.60], [19.50, 105.10], [19.85, 104.95],
    ]),
  },
  {
    name: 'Dak Lak',
    nameVi: 'Đắk Lắk',
    center: [12.70, 108.05],
    boundaryGeoJson: poly([
      [13.10, 107.55], [13.15, 108.10], [13.00, 108.55], [12.65, 108.70],
      [12.30, 108.50], [12.25, 108.00], [12.40, 107.55], [12.75, 107.40],
    ]),
  },
  {
    name: 'Long An',
    nameVi: 'Long An',
    center: [10.55, 106.42],
    boundaryGeoJson: poly([
      [10.75, 106.15], [10.78, 106.40], [10.68, 106.62], [10.48, 106.65],
      [10.35, 106.50], [10.33, 106.25], [10.45, 106.08], [10.62, 106.05],
    ]),
  },
  {
    name: 'Quang Ngai',
    nameVi: 'Quảng Ngãi',
    center: [15.12, 108.80],
    boundaryGeoJson: poly([
      [15.38, 108.45], [15.42, 108.78], [15.28, 109.10], [15.05, 109.18],
      [14.85, 109.00], [14.82, 108.65], [14.95, 108.40], [15.18, 108.32],
    ]),
  },
  {
    name: 'Quang Tri',
    nameVi: 'Quảng Trị',
    center: [16.75, 107.00],
    boundaryGeoJson: poly([
      [16.95, 106.55], [16.98, 106.90], [16.88, 107.25], [16.65, 107.35],
      [16.48, 107.18], [16.45, 106.82], [16.55, 106.50], [16.78, 106.42],
    ]),
  },
];
