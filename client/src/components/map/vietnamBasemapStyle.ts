import type {
  FilterSpecification,
  LayerSpecification,
  StyleSpecification,
} from 'maplibre-gl';

const LOCAL_SHORTBREAD_STYLES = {
  light: 'map-styles/shortbread-neutrino.json',
  dark: 'map-styles/shortbread-eclipse.json',
} as const;

const LOCAL_SHORTBREAD_SPRITE = 'map-styles/sprites/basics/sprites';
const LOCAL_FONT_STACK = ['Arial', 'Segoe UI', 'Noto Sans', 'sans-serif'] as const;
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
    const layerWithLocalFonts = layer.type === 'symbol' && layer.layout && 'text-field' in layer.layout
      ? ({
          ...layer,
          layout: {
            ...layer.layout,
            'text-font': [...LOCAL_FONT_STACK],
          },
        } as LayerSpecification)
      : layer;

    if (!('source-layer' in layerWithLocalFonts)) return layerWithLocalFonts;

    const sourceLayer = layerWithLocalFonts['source-layer'];
    if (sourceLayer === 'boundaries') {
      return {
        ...layerWithLocalFonts,
        filter: combineFilters(
          layerWithLocalFonts.filter,
          NON_DISPUTED_LAND_BOUNDARY_FILTER,
        ),
      } as LayerSpecification;
    }

    if (sourceLayer && LABEL_SOURCE_LAYERS.has(sourceLayer)) {
      return {
        ...layerWithLocalFonts,
        filter: combineFilters(layerWithLocalFonts.filter, BLOCKED_LABEL_FILTER),
      } as LayerSpecification;
    }

    return layerWithLocalFonts;
  });

  return { ...style, layers };
}

function resolvePublicAssetUrl(relativePath: string): string {
  return new URL(relativePath, `${window.location.origin}/`).toString();
}

function createFallbackBasemapStyle(isDark: boolean): StyleSpecification {
  return {
    version: 8,
    name: 'ReliefConnect resilient fallback',
    sources: {},
    layers: [
      {
        id: 'reliefconnect-fallback-background',
        type: 'background',
        paint: {
          'background-color': isDark ? '#111827' : '#e8eef5',
        },
      },
    ],
  };
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  return signal?.aborted === true
    || (error instanceof DOMException && error.name === 'AbortError');
}

export async function loadVietnamBasemapStyle(
  isDark: boolean,
  signal?: AbortSignal,
): Promise<StyleSpecification> {
  const styleAsset = isDark ? LOCAL_SHORTBREAD_STYLES.dark : LOCAL_SHORTBREAD_STYLES.light;

  try {
    const response = await fetch(resolvePublicAssetUrl(styleAsset), { signal });
    if (!response.ok) {
      throw new Error(`Không thể tải kiểu bản đồ nền (${response.status}).`);
    }

    const style = (await response.json()) as StyleSpecification;
    if (style.version !== 8 || !Array.isArray(style.layers)) {
      throw new Error('Kiểu bản đồ nền không đúng định dạng MapLibre Style v8.');
    }

    // The OSM style server only allows selected browser origins for style,
    // sprite and glyph resources. Styles and sprites are served locally, and
    // omitting `glyphs` makes MapLibre use the cross-platform local font stack.
    delete style.glyphs;
    style.sprite = [
      {
        id: 'basics',
        url: resolvePublicAssetUrl(LOCAL_SHORTBREAD_SPRITE),
      },
    ];

    return applyVietnamSovereigntyPolicy(style);
  } catch (error) {
    if (isAbortError(error, signal)) throw error;

    console.warn('[Basemap] Bundled Shortbread style unavailable; using fallback.', error);
    return createFallbackBasemapStyle(isDark);
  }
}
