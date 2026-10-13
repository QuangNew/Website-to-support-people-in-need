import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl';
import type { Locale } from '../../contexts/LanguageContext';

// ISO 3166-1 regions let the browser translate country names without adding a
// second map service. Shortbread currently provides English, but no vi/ja names.
const COUNTRY_CODES = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ '
  + 'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR '
  + 'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP '
  + 'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ '
  + 'NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW '
  + 'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ '
  + 'UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ');

const COUNTRY_ALIASES: Record<string, string> = {
  'Viet Nam': 'VN',
  Myanmar: 'MM',
  Burma: 'MM',
  'South Korea': 'KR',
  'North Korea': 'KP',
  'Czech Republic': 'CZ',
  Turkey: 'TR',
  'United States of America': 'US',
  'Russian Federation': 'RU',
  'Democratic Republic of the Congo': 'CD',
  'Republic of the Congo': 'CG',
  'East Timor': 'TL',
  Swaziland: 'SZ',
};

function countryLabel(locale: Locale): ExpressionSpecification {
  const englishName: ExpressionSpecification = ['coalesce', ['get', 'name_en'], ['get', 'name'], ''];
  if (locale === 'en') return englishName;

  const english = new Intl.DisplayNames(['en'], { type: 'region' });
  const localized = new Intl.DisplayNames([locale], { type: 'region' });
  const names = new Map<string, string>();
  for (const code of COUNTRY_CODES) {
    const name = english.of(code);
    if (name) names.set(name, localized.of(code) || name);
  }
  for (const [name, code] of Object.entries(COUNTRY_ALIASES)) {
    names.set(name, localized.of(code) || name);
  }

  const expression: unknown[] = ['match', englishName];
  for (const [name, translation] of names) expression.push(name, translation);
  expression.push(englishName);
  return expression as ExpressionSpecification;
}

/** Add readable labels and natural colors without changing geometry or filters. */
export function applyBasemapPresentation(
  style: StyleSpecification,
  isDark: boolean,
  locale: Locale,
): StyleSpecification {
  const colors = isDark ? {
    land: '#263b32', water: '#164c6b', forest: '#356449', grass: '#405e3c',
    park: '#3e6c46', agriculture: '#4c5537', sand: '#62583e', wetland: '#355e54',
    residential: '#34473e', commercial: '#4c4842', industrial: '#494c47', building: '#5a6257',
    road: '#aab4a3', roadOutline: '#263a30', highway: '#e1ae61', mainRoad: '#c9b884',
    text: '#f0f5eb', halo: '#263b32', boundary: '#91a797',
  } : {
    land: '#f4f1e6', water: '#8dc9eb', forest: '#a8ce99', grass: '#c9dfa8',
    park: '#b9dca3', agriculture: '#e5e7bc', sand: '#f2e2b8', wetland: '#b4d9c7',
    residential: '#e8e7df', commercial: '#eee0d4', industrial: '#e0e2dd', building: '#d4ccc0',
    road: '#ffffff', roadOutline: '#d4c9b4', highway: '#f5c979', mainRoad: '#f8e0a1',
    text: '#34483e', halo: '#fffdf7', boundary: '#9c8c81',
  };
  const landColors: Record<string, string> = {
    'land-forest': colors.forest,
    'land-grass': colors.grass,
    'land-vegetation': colors.park,
    'land-park': colors.park,
    'land-garden': colors.park,
    'land-leisure': colors.park,
    'land-burial': colors.grass,
    'land-agriculture': colors.agriculture,
    'land-sand': colors.sand,
    'land-wetland': colors.wetland,
    'land-residential': colors.residential,
    'land-commercial': colors.commercial,
    'land-industrial': colors.industrial,
    'land-rock': colors.building,
  };
  const countryText = countryLabel(locale);
  const placeText: ExpressionSpecification = locale === 'vi'
    // Keep Vietnamese street/place spelling where available, use English for
    // neighbouring countries instead of Thai, Chinese or other native scripts.
    ? ['coalesce', ['get', 'name_vi'], ['get', 'name_en'], ['get', 'name'], '']
    : ['coalesce', ['get', `name_${locale}`], ['get', 'name_en'], ['get', 'name'], ''];

  const layers = style.layers.map((layer): LayerSpecification => {
    if (layer.type === 'background') {
      return { ...layer, paint: { ...layer.paint, 'background-color': colors.land } };
    }
    if (layer.type === 'fill') {
      let color = landColors[layer.id];
      if (/^water-(ocean|area)/.test(layer.id)) color = colors.water;
      if (layer.id === 'building') color = colors.building;
      return color ? { ...layer, paint: { ...layer.paint, 'fill-color': color } } : layer;
    }
    if (layer.type === 'line') {
      let color: string | undefined;
      if (layer['source-layer'] === 'water_lines') color = colors.water;
      if (layer['source-layer'] === 'boundaries') {
        color = layer.id.endsWith(':outline') ? colors.land : colors.boundary;
      }
      if (layer['source-layer'] === 'streets' && layer.id.includes('street-')) {
        color = layer.id.endsWith(':outline') ? colors.roadOutline
          : /street-(motorway|trunk)/.test(layer.id) ? colors.highway
          : /street-(primary|secondary|tertiary)/.test(layer.id) ? colors.mainRoad
          : colors.road;
      }
      return color ? { ...layer, paint: { ...layer.paint, 'line-color': color } } : layer;
    }
    if (layer.type === 'symbol' && layer.layout?.['text-field']
      && ['boundary_labels', 'place_labels'].includes(layer['source-layer'] || '')) {
      return {
        ...layer,
        layout: {
          ...layer.layout,
          'text-field': layer.id.startsWith('label-boundary-country-') ? countryText : placeText,
        },
        paint: { ...layer.paint, 'text-color': colors.text, 'text-halo-color': colors.halo },
      };
    }
    return layer;
  });
  return { ...style, layers };
}
