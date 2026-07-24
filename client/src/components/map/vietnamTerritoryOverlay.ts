import type { GeoJsonObject } from 'geojson';

export interface VietnamIslandTerritory {
  id: 'hoang-sa' | 'truong-sa';
  nameVi: string;
  administrativeUnit: string;
  center: { lat: number; lng: number };
  dataUrl: string;
}

export const VIETNAM_ISLAND_TERRITORIES: readonly VietnamIslandTerritory[] = [
  {
    id: 'hoang-sa',
    nameVi: 'Quần đảo Hoàng Sa',
    administrativeUnit: 'Đặc khu Hoàng Sa, thành phố Đà Nẵng',
    center: { lat: 16.8333, lng: 112.3333 },
    dataUrl: '/data/vietnam-territory/hoang-sa.geojson',
  },
  {
    id: 'truong-sa',
    nameVi: 'Quần đảo Trường Sa',
    administrativeUnit: 'Đặc khu Trường Sa, tỉnh Khánh Hòa',
    center: { lat: 8.6333, lng: 111.9167 },
    dataUrl: '/data/vietnam-territory/truong-sa.geojson',
  },
] as const;

export interface LoadedVietnamIslandTerritory extends VietnamIslandTerritory {
  geoJson: GeoJsonObject;
}

export async function loadVietnamIslandTerritories(
  signal?: AbortSignal,
): Promise<LoadedVietnamIslandTerritory[]> {
  return Promise.all(
    VIETNAM_ISLAND_TERRITORIES.map(async (territory) => {
      const response = await fetch(territory.dataUrl, { signal });
      if (!response.ok) {
        throw new Error(`Không thể tải dữ liệu ${territory.nameVi} (${response.status}).`);
      }

      const geoJson = (await response.json()) as GeoJsonObject;
      if (geoJson.type !== 'Feature' && geoJson.type !== 'FeatureCollection') {
        throw new Error(`Dữ liệu ${territory.nameVi} không đúng định dạng GeoJSON.`);
      }

      return { ...territory, geoJson };
    }),
  );
}
