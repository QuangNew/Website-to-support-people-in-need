import type {
  FilterSpecification,
  LayerSpecification,
  StyleSpecification,
} from 'maplibre-gl';

const OSM_SHORTBREAD_STYLES = {
  light: 'https://vector.openstreetmap.org/styles/shortbread/neutrino.json',
  dark: 'https://vector.openstreetmap.org/styles/shortbread/eclipse.json',
} as const;

const LABEL_SOURCE_LAYERS = new Set(['boundary_labels', 'place_labels']);

/**
 * Labels that represent the disputed Chinese administrative entities or
 * duplicate the Vietnamese labels rendered by the authoritative overlay.
 * Values are normalized to lowercase before matching.
 */
export const SOVEREIGNTY_BLOCKED_NAMES = [
  'sansha',
  'sansha city',
  '三沙',
  '三沙市',
  'xisha',
  'xisha district',
  '西沙',
  '西沙区',
  'paracel islands',
  'the paracel islands',
  '西沙群岛',
  'nansha',
  'nansha district',
  '南沙',
  '南沙区',
  'spratly islands',
  'the spratly islands',
  '南沙群岛',
] as const;

const NON_DISPUTED_LAND_BOUNDARY_FILTER = [
  'all',
  ['!=', ['get', 'maritime'], true],
  ['!=', ['get', 'disputed'], true],
] as unknown as FilterSpecification;

const BLOCKED_LABEL_FILTER = [
  '!',
  [
    'in',
    ['downcase', ['coalesce', ['get', 'name_en'], ['get', 'name'], '']],
    ['literal', SOVEREIGNTY_BLOCKED_NAMES],
  ],
] as unknown as FilterSpecification;

function combineFilters(
  existing: FilterSpecification | undefined,
  required: FilterSpecification,
): FilterSpecification {
  return existing
    ? (['all', existing, required] as unknown as FilterSpecification)
    : required;
}

/**
 * Applies the application's Vietnam sovereignty policy before the style is
 * handed to MapLibre. This prevents an incorrect label or disputed maritime
 * boundary from flashing on screen during initial rendering.
 */
export function applyVietnamSovereigntyPolicy(style: StyleSpecification): StyleSpecification {
  const layers = style.layers.map((layer): LayerSpecification => {
    if (!('source-layer' in layer)) return layer;

    const sourceLayer = layer['source-layer'];
    if (sourceLayer === 'boundaries') {
      return {
        ...layer,
        filter: combineFilters(layer.filter, NON_DISPUTED_LAND_BOUNDARY_FILTER),
      } as LayerSpecification;
    }

    if (sourceLayer && LABEL_SOURCE_LAYERS.has(sourceLayer)) {
      return {
        ...layer,
        filter: combineFilters(layer.filter, BLOCKED_LABEL_FILTER),
      } as LayerSpecification;
    }

    return layer;
  });

  return { ...style, layers };
}

export async function loadVietnamBasemapStyle(
  isDark: boolean,
  signal?: AbortSignal,
): Promise<StyleSpecification> {
  const styleUrl = isDark ? OSM_SHORTBREAD_STYLES.dark : OSM_SHORTBREAD_STYLES.light;
  const response = await fetch(styleUrl, { signal });

  if (!response.ok) {
    throw new Error(`Không thể tải kiểu bản đồ nền (${response.status}).`);
  }

  const style = (await response.json()) as StyleSpecification;
  if (style.version !== 8 || !Array.isArray(style.layers)) {
    throw new Error('Kiểu bản đồ nền không đúng định dạng MapLibre Style v8.');
  }

  return applyVietnamSovereigntyPolicy(style);
}
