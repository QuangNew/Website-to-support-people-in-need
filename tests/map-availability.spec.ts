import { expect, test } from '@playwright/test';

for (const tileFailure of ['refused', 'pending'] as const) {
  test(`keeps SOS markers usable when basemap requests are ${tileFailure}`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('rc-welcome-seen', 'true'));
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/map/pings*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: 1,
        lat: 16.0471,
        lng: 108.2068,
        type: 'need_help',
        details: 'Need help',
        status: 'active',
        createdAt: '2026-10-13T00:00:00Z',
      }]),
    }));

    let tileRequests = 0;
    await page.route('https://tiles.versatiles.org/tiles/osm/**', (route) => {
      tileRequests += 1;
      if (tileFailure === 'refused') return route.abort('connectionrefused');
      // Leave requests pending to reproduce a tile server that never responds.
    });

    await page.goto('/');
    await expect.poll(() => tileRequests).toBeGreaterThan(0);
    await expect(page.locator('.map-fallback')).toHaveCount(0);
    await expect(page.locator('button.map-marker[aria-label="need_help"]')).toBeVisible();
    await expect(page.locator('[data-territory="hoang-sa"]')).toBeVisible();
    await expect(page.locator('[data-territory="truong-sa"]')).toBeVisible();
  });
}
