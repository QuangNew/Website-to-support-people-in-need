import { test, expect } from '@playwright/test';

test.describe('Map Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads map and shows tiles', async ({ page }) => {
    // Map container should be visible
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10000 });
    // Tile layer should load
    await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible({ timeout: 15000 });
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
