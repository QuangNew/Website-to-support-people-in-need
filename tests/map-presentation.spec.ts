import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { applyBasemapPresentation } from '../client/src/components/map/basemapPresentation';
import { applyVietnamSovereigntyPolicy } from '../client/src/components/map/vietnamBasemapStyle';

// Use the same expression engine as the installed renderer, including its type
// checks, instead of duplicating MapLibre's expression rules in the tests.
const rendererRequire = createRequire(realpathSync(resolve('client/node_modules/maplibre-gl/package.json')));
const { createExpression, validateStyleMin } = rendererRequire('@maplibre/maplibre-gl-style-spec');

for (const [locale, thailand, vietnam] of [
  ['vi', 'Thái Lan', 'Việt Nam'],
  ['en', 'Thailand', 'Vietnam'],
  ['ja', 'タイ', 'ベトナム'],
] as const) {
  test(`renders country names in ${locale} instead of native scripts`, () => {
    const style = applyBasemapPresentation({
      version: 8,
      sources: { shortbread: { type: 'vector', tiles: ['https://example.com/{z}/{x}/{y}'] } },
      layers: [{
        id: 'label-boundary-country-medium',
        type: 'symbol',
        source: 'shortbread',
        'source-layer': 'boundary_labels',
        layout: { 'text-field': ['get', 'name'] },
      }],
    }, false, locale);
    const layer = style.layers[0];
    if (layer.type !== 'symbol') throw new Error('Country label is missing');
    const compiled = createExpression(layer.layout?.['text-field'], 'layers[0].layout.text-field');
    expect(compiled.result).toBe('success');
    const label = (properties: Record<string, string>) => compiled.value.evaluate({ zoom: 5 }, {
      type: 1, properties,
    });
    expect(label({ name: 'ประเทศไทย', name_en: 'Thailand' })).toBe(thailand);
    expect(label({ name: 'Việt Nam', name_en: 'Vietnam' })).toBe(vietnam);
    expect(label({ name: 'Việt Nam', name_en: 'Viet Nam' })).toBe(locale === 'en' ? 'Viet Nam' : vietnam);
    expect(label({ name: 'ตัวอย่าง', name_en: 'Unknown Country' })).toBe('Unknown Country');
    expect(label({ name: 'Local name only' })).toBe('Local name only');
  });
}

for (const isDark of [false, true]) {
  test(`keeps the ${isDark ? 'dark' : 'light'} style valid with blue water and green vegetation`, () => {
    const original = JSON.parse(readFileSync(resolve(
      `client/public/map-styles/shortbread-${isDark ? 'eclipse' : 'neutrino'}.json`,
    ), 'utf8'));
    for (const locale of ['vi', 'en', 'ja'] as const) {
      const style = applyVietnamSovereigntyPolicy(applyBasemapPresentation(original, isDark, locale));
      expect(validateStyleMin(style).map((error: { message: string }) => error.message)).toEqual([]);
      const water = style.layers.find((layer) => layer.id === 'water-ocean');
      const forest = style.layers.find((layer) => layer.id === 'land-forest');
      if (water?.type !== 'fill' || forest?.type !== 'fill') throw new Error('Natural layers are missing');
      const rgb = (hex: unknown) => String(hex).slice(1).match(/../g)!.map((value) => parseInt(value, 16));
      const [waterRed, , waterBlue] = rgb(water.paint?.['fill-color']);
      const [forestRed, forestGreen, forestBlue] = rgb(forest.paint?.['fill-color']);
      expect(waterBlue).toBeGreaterThan(waterRed);
      expect(forestGreen).toBeGreaterThan(forestRed);
      expect(forestGreen).toBeGreaterThan(forestBlue);
      expect(JSON.stringify(original.layers)).not.toContain('name_vi');
    }
  });
}

test('updates the map when the UI language changes without losing territory labels', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rc-welcome-seen', 'true');
    localStorage.setItem('rc-locale', 'vi');
  });
  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('https://tiles.versatiles.org/tiles/osm/**', (route) => route.fulfill({
    status: 200, contentType: 'application/vnd.mapbox-vector-tile', body: Buffer.alloc(0),
  }));
  let styleRequests = 0;
  await page.route('**/map-styles/shortbread-*.json', (route) => {
    styleRequests += 1;
    return route.continue();
  });
  await page.goto('/');
  await expect(page.locator('[data-territory="hoang-sa"]')).toBeVisible();
  for (const [buttonTitle, locale] of [['English', 'en'], ['日本語', 'ja'], ['Tiếng Việt', 'vi']]) {
    const previousRequests = styleRequests;
    await page.locator(`.sidebar-bottom button[title="${buttonTitle}"]`).click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('rc-locale'))).toBe(locale);
    await expect.poll(() => styleRequests).toBeGreaterThan(previousRequests);
    await expect(page.locator('[data-territory="hoang-sa"]')).toBeVisible();
    await expect(page.locator('[data-territory="truong-sa"]')).toBeVisible();
  }
});
