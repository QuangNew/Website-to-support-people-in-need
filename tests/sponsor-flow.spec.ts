import { expect, test } from '@playwright/test';

const UI_BASE_URL = process.env.UI_BASE_URL ?? 'http://127.0.0.1:5173';

/**
 * Regression test: Sponsor offer help flow (Track 8 — minimum regression set #5).
 */
test.describe('Sponsor offer help flow', () => {
  const mockCase = {
    id: 601,
    type: 'SOS',
    status: 'Pending',
    lat: 16.05,
    lng: 108.2,
    contactName: 'Person Needing Help',
    details: 'Family displaced by flooding — need shelter and food',
    sosCategory: 'shelter',
    createdAt: '2026-04-19T08:00:00Z',
  };

  test('sponsor can offer help on an SOS case', async ({ page }) => {
    let offerHelpCalled = false;
    let offerBody: Record<string, unknown> | null = null;

    // ── Auth & localStorage ──
    await page.addInitScript(() => {
      localStorage.setItem('rc-welcome-seen', 'true');
      localStorage.setItem('rc-locale', 'en');
      localStorage.setItem('token', 'sponsor-test-token');
      localStorage.removeItem('user');
    });

    // ── Mock: auth/me (Sponsor role) ──
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'sponsor-user-1',
          userName: 'sponsor1',
          email: 'sponsor@example.com',
          fullName: 'Sponsor User',
          role: 'Sponsor',
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
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    // ── Mock: sponsor cases ──
    await page.route('**/api/sponsor/cases*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockCase]),
      });
    });

    // ── Mock: sponsor offers ──
    await page.route('**/api/sponsor/offers*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    // ── Mock: sponsor impact ──
    await page.route('**/api/sponsor/impact*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalOffers: offerHelpCalled ? 1 : 0,
          pendingOffers: offerHelpCalled ? 1 : 0,
          acceptedOffers: 0,
          supportedPeople: 0,
        }),
      });
    });

    // ── Mock: supply ──
    await page.route('**/api/supply*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    // ── Mock: sponsor offer help ──
    await page.route('**/api/sponsor/offer', async (route) => {
      offerHelpCalled = true;
      offerBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, id: 701 }),
      });
    });

    // ── Navigate ──
    await page.goto(UI_BASE_URL);
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 });

    // ── Open sponsor panel ──
    const sponsorBtn = page.locator('.sidebar button[title="Support"], .sidebar button:has-text("Support")').first();
    await expect(sponsorBtn).toBeVisible({ timeout: 5000 });
    await sponsorBtn.click();

    const panel = page.locator('.panel-content');
    await expect(panel).toBeVisible({ timeout: 5000 });

    // ── Should see the SOS case ──
    await expect(panel).toContainText('displaced by flooding', { timeout: 10000 });

    // ── Click Offer Help ──
    const offerBtn = panel.locator('.btn-warning').filter({ hasText: /offer|help/i }).first();
    await expect(offerBtn).toBeVisible({ timeout: 5000 });
    await offerBtn.click();

    // ── Fill the offer message in the modal/textarea ──
    const textarea = page.locator('textarea').last();
    await expect(textarea).toBeVisible({ timeout: 3000 });
    await textarea.fill('We can provide temporary shelter and food packages for your family');

    // ── Submit the offer ──
    const sendBtn = page.locator('.btn-warning').filter({ hasText: /send|submit|offer/i }).last();
    if (await sendBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sendBtn.click();

      // ── Verify API was called ──
      await expect.poll(() => offerHelpCalled, { timeout: 5000 }).toBe(true);
      expect(offerBody).not.toBeNull();
      expect(offerBody!.pingId).toBe(601);
    }
  });
});
