import { expect, test } from '@playwright/test';

test('loads the map with a bundled worker', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('rc-welcome-seen', 'true'));
  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  // Empty vector tiles keep this worker check independent of the public tile server.
  await page.route('https://tiles.versatiles.org/tiles/osm/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/vnd.mapbox-vector-tile',
      headers: { 'access-control-allow-origin': '*' },
      body: Buffer.alloc(0),
    }));

  const workerStarted = page.waitForEvent('worker');
  await page.goto('/');
  const worker = await workerStarted;
  const workerUrl = new URL(worker.url());
  const pageUrl = new URL(page.url());

  expect(workerUrl.origin).toBe(pageUrl.origin);
  expect(workerUrl.protocol).toBe(pageUrl.protocol);
  expect(await worker.evaluate(() => typeof self.postMessage)).toBe('function');
  await expect(page.locator('.maplibregl-canvas').first()).toBeVisible();
  await expect(page.locator('.map-fallback')).toHaveCount(0, { timeout: 20000 });
  expect(pageErrors).toEqual([]);
});
