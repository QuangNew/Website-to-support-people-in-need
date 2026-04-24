import { expect, test } from '@playwright/test';

const UI_BASE_URL = process.env.UI_BASE_URL ?? 'http://127.0.0.1:5173';

/**
 * Regression test: Person-in-need confirm safe (Track 8 — minimum regression set #7).
 */
test.describe('Person-in-need confirm safe flow', () => {
  const mockPing = {
    id: 401,
    lat: 16.05,
    lng: 108.2,
    type: 'SOS',
    status: 'Pending',
    priorityLevel: 3,
    details: 'Need help with evacuation from flood zone',
    createdAt: '2026-04-19T05:00:00Z',
    userName: 'Person Tester',
    isBlinking: true,
  };

  test('person-in-need can confirm safe on a pending SOS', async ({ page }) => {
    let confirmSafeCalled = false;
    let confirmSafePingId: number | null = null;

    // ── Auth & localStorage ──
    await page.addInitScript(() => {
      localStorage.setItem('rc-welcome-seen', 'true');
      localStorage.setItem('rc-locale', 'en');
      localStorage.setItem('token', 'pin-test-token');
      localStorage.removeItem('user');
    });

    // ── Mock: auth/me (PersonInNeed role) ──
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'pin-user-1',
          userName: 'person1',
          email: 'person@example.com',
          fullName: 'Person In Need',
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

    // ── Mock: map pings ──
    await page.route(/\/api\/map\/pings(?:\/\d+)?(?:\?.*)?$/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    // ── Mock: user pings ──
    await page.route('**/api/map/pings/user/pin-user-1*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockPing]),
      });
    });

    // ── Mock: person-in-need offers ──
    await page.route('**/api/personInNeed/offers*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    // ── Mock: confirm safe ──
    await page.route(/\/api\/map\/pings\/\d+\/confirm-safe/, async (route) => {
      const url = route.request().url();
      const match = url.match(/\/pings\/(\d+)\/confirm-safe/);
      confirmSafePingId = match ? Number(match[1]) : null;
      confirmSafeCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // ── Navigate ──
    await page.goto(UI_BASE_URL);
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 });

    // ── Open My SOS panel ──
    const mySosBtn = page.locator('.sidebar button[title="My SOS"], .sidebar button:has-text("My SOS")').first();
    await expect(mySosBtn).toBeVisible({ timeout: 5000 });
    await mySosBtn.click();

    const panel = page.locator('.panel-content');
    await expect(panel).toBeVisible({ timeout: 5000 });

    // ── Should see the pending SOS ──
    await expect(panel).toContainText('evacuation from flood zone', { timeout: 10000 });
    await expect(panel).toContainText('SOS #401');

    // ── Click Confirm Safe ──
    const confirmBtn = panel.locator('.btn-success').filter({ hasText: /confirm|safe/i }).first();
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();

    // ── Verify API was called ──
    await expect.poll(() => confirmSafeCalled, { timeout: 5000 }).toBe(true);
    expect(confirmSafePingId).toBe(401);

    // ── After confirm, the status should update to VerifiedSafe ──
    // The button should disappear (canConfirmSafe is false for VerifiedSafe)
    await expect(panel.locator('.btn-success').filter({ hasText: /confirm|safe/i })).toHaveCount(0, { timeout: 5000 });
  });
});
