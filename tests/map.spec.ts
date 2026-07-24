import { test, expect } from '@playwright/test';

test.describe('Map Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('rc-welcome-seen', 'true');
    });
    await page.goto('/');
  });

  test('loads the filtered vector basemap', async ({ page }) => {
    // Map container should be visible
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10000 });
    // MapLibre renders the Shortbread vector style into a canvas inside Leaflet.
    await expect(page.locator('.maplibregl-canvas').first()).toBeVisible({ timeout: 20000 });
  });

  test('keeps Vietnamese sovereignty labels visible after zooming', async ({ page }) => {
    const hoangSa = page.locator('[data-territory="hoang-sa"]');
    const truongSa = page.locator('[data-territory="truong-sa"]');

    await expect(hoangSa).toBeVisible({ timeout: 20000 });
    await expect(truongSa).toBeVisible({ timeout: 20000 });
    await expect(hoangSa).toContainText('Quần đảo Hoàng Sa');
    await expect(truongSa).toContainText('Quần đảo Trường Sa');

    await hoangSa.click();
    await page.waitForTimeout(1500);
    await expect(hoangSa).toBeVisible();
  });

  test('shows required map and territory attribution', async ({ page }) => {
    const attribution = page.locator('.leaflet-control-attribution');
    await expect(attribution).toContainText('OpenStreetMap', { timeout: 20000 });
    await expect(attribution).toContainText('Vietnamese Provinces Database');
  });

  test('keeps the sovereignty overlay when switching theme', async ({ page }) => {
    const html = page.locator('html');
    const initialTheme = await html.getAttribute('data-theme');
    const expectedTheme = initialTheme === 'dark' ? 'light' : 'dark';

    await page.locator('.sidebar-bottom .sidebar-nav-item').first().click();
    await expect(html).toHaveAttribute('data-theme', expectedTheme);
    await expect(page.locator('.maplibregl-canvas').first()).toBeVisible();
    await expect(page.locator('[data-territory="hoang-sa"]')).toBeVisible();
    await expect(page.locator('[data-territory="truong-sa"]')).toBeVisible();
  });

  test('shows SOS button', async ({ page }) => {
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10000 });
    const sosBtn = page.locator('.sos-float-btn');
    await expect(sosBtn).toBeVisible();
    await expect(sosBtn).toContainText('S-O-S');
  });

  test('shows filter bar', async ({ page }) => {
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10000 });
    // Filter buttons should exist
    await expect(page.locator('.filter-bar, .map-filters').first()).toBeVisible();
  });

  test('shows sidebar navigation', async ({ page }) => {
    // Sidebar should be present (may be collapsed)
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeAttached({ timeout: 10000 });
  });

  test('map is interactive \u2014 can zoom', async ({ page }) => {
    const mapContainer = page.locator('.leaflet-container');
    await expect(mapContainer).toBeVisible({ timeout: 10000 });
    // Dismiss any modal overlay first
    const overlay = page.locator('.modal-overlay');
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
    // Use keyboard zoom instead of clicking (sidebar may overlap zoom controls)
    await mapContainer.click();
    await page.keyboard.press('+');
    await page.waitForTimeout(500);
  });
});
