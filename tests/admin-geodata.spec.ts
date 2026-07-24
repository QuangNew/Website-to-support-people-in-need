import { expect, test } from '@playwright/test';

const SAMPLE_BOUNDARY = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { code: '01', fullName: 'Thành phố Hà Nội' },
    geometry: {
      type: 'MultiPolygon',
      coordinates: [[[
        [105.7, 20.9],
        [106.0, 20.9],
        [106.0, 21.2],
        [105.7, 21.2],
        [105.7, 20.9],
      ]]],
    },
  }],
};

test.describe('Admin administrative GeoJSON picker', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'admin-geodata-test-token');
      localStorage.setItem('rc-theme', 'light');
      localStorage.setItem('rc-locale', 'en');
      localStorage.setItem('rc-welcome-seen', 'true');
    });

    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('https://vector.openstreetmap.org/styles/shortbread/*.json', (route) =>
      route.abort());
    await page.route(
      'https://raw.githubusercontent.com/thanglequoc/vietnamese-provinces-database/**',
      (route) => route.fulfill({
        status: 200,
        contentType: 'application/geo+json',
        body: JSON.stringify(SAMPLE_BOUNDARY),
      }),
    );
    await page.route('**/api/auth/me', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'admin-geodata',
        userName: 'admin',
        email: 'admin@example.com',
        fullName: 'Geo Admin',
        role: 'Admin',
        verificationStatus: 'Approved',
        emailVerified: true,
        createdAt: '2026-07-25T00:00:00Z',
      }),
    }));
    await page.route('**/api/zone*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/supply*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  });

  test('fills a priority zone with a standard administrative boundary', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Zones', exact: true }).click();
    await page.getByRole('button', { name: /New Zone/i }).click();

    await page.getByLabel('Tỉnh hoặc thành phố').selectOption('01');
    await expect(page.getByPlaceholder('Zone name *')).toHaveValue('Thành phố Hà Nội');

    const rawGeoJson = page.locator('.admin-geo-picker__advanced textarea');
    await expect(rawGeoJson).toHaveValue(/"type":"MultiPolygon"/);
  });

  test('chooses supply coordinates without latitude/longitude inputs', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Supply', exact: true }).click();
    await page.getByRole('button', { name: /New Supply/i }).click();

    await page.getByLabel('Tỉnh hoặc thành phố').selectOption('01');

    await expect(page.getByPlaceholder('Supply name *'))
      .toHaveValue('Điểm cung ứng — Thành phố Hà Nội');
    await expect(page.locator('.admin-supply-coordinate strong')).not.toContainText('Not selected');
    await expect(page.getByLabel('Latitude')).toHaveCount(0);
    await expect(page.getByLabel('Longitude')).toHaveCount(0);
  });
});
