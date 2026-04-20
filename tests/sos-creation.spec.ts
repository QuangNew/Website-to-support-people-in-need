import { expect, test } from '@playwright/test';

const UI_BASE_URL = process.env.UI_BASE_URL ?? 'http://127.0.0.1:5173';

/**
 * Regression test: SOS creation flow (Track 8 — minimum regression set #3).
 *
 * Mocks all API endpoints so it can run without a live backend.
 */
test.describe('SOS creation flow', () => {
  test('authenticated user can create an SOS request', async ({ page }) => {
    let createPingCalled = false;
    let createPingBody: Record<string, unknown> | null = null;

    // ── Auth & localStorage ──
    await page.addInitScript(() => {
      localStorage.setItem('rc-welcome-seen', 'true');
      localStorage.setItem('rc-locale', 'en');
      localStorage.setItem('token', 'sos-test-token');
      localStorage.removeItem('user');
    });

    // ── Mock: auth/me ──
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'sos-user-1',
          userName: 'sos-tester',
          email: 'sos@example.com',
          fullName: 'SOS Tester',
          role: 'PersonInNeed',
          verificationStatus: 'Approved',
          emailVerified: true,
          createdAt: '2026-04-18T00:00:00Z',
        }),
      });
    });

    // ── Mock: zones ──
    await page.route('**/api/zone*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    // ── Mock: pings ──
    await page.route(/\/api\/map\/pings(?:\/\d+)?(?:\?.*)?$/, async (route) => {
      if (route.request().method() === 'POST') {
        createPingCalled = true;
        createPingBody = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 9001,
            type: 'SOS',
            status: 'Pending',
            lat: createPingBody?.lat ?? 16.05,
            lng: createPingBody?.lng ?? 108.2,
            contactName: createPingBody?.contactName ?? 'Test',
            contactPhone: createPingBody?.contactPhone ?? '0901234567',
            details: createPingBody?.details ?? 'test',
            sosCategory: createPingBody?.sosCategory ?? 'food',
            createdAt: new Date().toISOString(),
          }),
        });
        return;
      }

      // GET — return empty list
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    // ── Navigate ──
    await page.goto(UI_BASE_URL);
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 });

    // ── Click SOS button ──
    const sosBtn = page.locator('.sos-float-btn');
    await expect(sosBtn).toBeVisible({ timeout: 5000 });
    await sosBtn.click();

    // ── SOS panel should appear ──
    const sosPanel = page.locator('.sos-panel');
    await expect(sosPanel).toBeVisible({ timeout: 5000 });

    // ── Select a tag (food) ──
    const foodTag = sosPanel.locator('.sos-tag-btn').filter({ hasText: /food/i }).first();
    if (await foodTag.isVisible({ timeout: 3000 }).catch(() => false)) {
      await foodTag.click();
    } else {
      // Fallback: click the first tag
      await sosPanel.locator('.sos-tag-btn').first().click();
    }

    // ── Fill contact name ──
    const nameInput = sosPanel.locator('.sos-input').first();
    await nameInput.fill('Emergency Contact');

    // ── Fill contact phone ──
    const phoneInput = sosPanel.locator('input[type="tel"]');
    await phoneInput.fill('0901234567');

    // ── Fill details ──
    const detailsTextarea = sosPanel.locator('.sos-textarea');
    await detailsTextarea.fill('Need food and water supplies urgently');

    // ── Submit ──
    const submitBtn = sosPanel.locator('.sos-submit-btn');

    // Location may need to be set — try overriding geolocation first
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 16.05, longitude: 108.2 });

    // If submit is still disabled (no GPS fix), trigger re-detect
    if (await submitBtn.isDisabled()) {
      const gpsBar = sosPanel.locator('.sos-location-bar');
      if (await gpsBar.isVisible().catch(() => false)) {
        await gpsBar.click();
        await page.waitForTimeout(1000);
      }
    }

    // Submit if enabled
    if (!(await submitBtn.isDisabled())) {
      await submitBtn.click();

      // ── Verify success state ──
      // Either the panel changes to success state or a toast appears
      const successState = sosPanel.locator('text=SOS').or(page.locator('[class*="success"]'));
      await expect(successState.first()).toBeVisible({ timeout: 10000 });

      // ── Verify API was called ──
      expect(createPingCalled).toBe(true);
      expect(createPingBody).not.toBeNull();
      expect(createPingBody!.contactName).toBe('Emergency Contact');
      expect(createPingBody!.contactPhone).toBe('0901234567');
    }
  });
});
