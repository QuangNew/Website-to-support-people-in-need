import { expect, test } from '@playwright/test';

const UI_BASE_URL = process.env.UI_BASE_URL ?? 'http://127.0.0.1:5173';

test.describe('Map detail and social reporting UI', () => {
  test('refreshes ping detail for volunteer contact access and submits a post report', async ({ page }) => {
    let authMeRequests = 0;
    let mapDetailRequests = 0;
    let reportedReason = '';

    await page.addInitScript(() => {
      localStorage.setItem('rc-welcome-seen', 'true');
      localStorage.setItem('rc-locale', 'en');
      localStorage.setItem('token', 'ui-volunteer-token');
      localStorage.removeItem('user');
    });

    await page.route('**/api/auth/me', async (route) => {
      authMeRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'volunteer-1',
          userName: 'volunteer-ui',
          email: 'volunteer-ui@example.com',
          fullName: 'Volunteer UI',
          role: 'Volunteer',
          verificationStatus: 'Approved',
          emailVerified: true,
          createdAt: '2026-04-18T00:00:00Z',
        }),
      });
    });

    await page.route('**/api/zone*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route(/\/api\/map\/pings(?:\/\d+)?(?:\?.*)?$/, async (route) => {
      const url = new URL(route.request().url());

      if (url.pathname.endsWith('/api/map/pings/101')) {
        mapDetailRequests += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 101,
            lat: 10.762622,
            lng: 106.660172,
            type: 'SOS',
            status: 'Pending',
            details: 'Need urgent medical help',
            createdAt: '2026-04-18T09:00:00Z',
            contactName: 'Volunteer Reporter',
            contactPhone: '0901234567',
            contactEmail: 'reporter@example.com',
            sosCategory: 'medical',
            isBlinking: true,
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 101,
            lat: 10.762622,
            lng: 106.660172,
            type: 'SOS',
            status: 'Pending',
            details: 'Need urgent medical help',
            createdAt: '2026-04-18T09:00:00Z',
            contactName: 'Volunteer Reporter',
            contactPhone: null,
            contactEmail: null,
            sosCategory: 'medical',
            isBlinking: true,
          },
        ]),
      });
    });

    await page.route(/\/api\/social\/posts(?:\/\d+(?:\/(?:comments|reports))?)?(?:\?.*)?$/, async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === 'GET' && url.pathname.endsWith('/api/social/posts')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                id: 501,
                content: 'This SOS summary is intentionally misleading for moderation testing.',
                category: 'Medical',
                createdAt: '2026-04-18T10:00:00Z',
                authorId: 'other-user',
                authorName: 'Other Author',
                authorRole: 'Guest',
                likeCount: 0,
                loveCount: 0,
                prayCount: 0,
                commentCount: 0,
              },
            ],
            nextCursor: null,
          }),
        });
        return;
      }

      if (request.method() === 'GET' && url.pathname.endsWith('/api/social/posts/501/comments')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], nextCursor: null }),
        });
        return;
      }

      if (request.method() === 'POST' && url.pathname.endsWith('/api/social/posts/501/reports')) {
        const payload = request.postDataJSON() as { reason?: string };
        reportedReason = payload.reason ?? '';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Report submitted' }),
        });
        return;
      }

      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unexpected social request in UI regression test.' }),
      });
    });

    await page.goto(UI_BASE_URL);

    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.sidebar .sidebar-nav-danger')).toBeVisible();
    expect(authMeRequests).toBeGreaterThan(0);

    const pingMarker = page.locator('button.map-marker[aria-label="Need urgent medical help"]');
    await expect(pingMarker).toBeVisible({ timeout: 10000 });
    await pingMarker.click();
    await expect.poll(() => mapDetailRequests, { timeout: 10000 }).toBeGreaterThan(0);

    const pingDetailPanel = page.locator('.ping-detail-panel');
    await expect(pingDetailPanel).toBeVisible();
    await expect(pingDetailPanel).toContainText('Volunteer Reporter');
    await expect(pingDetailPanel).toContainText('0901234567', { timeout: 10000 });
    expect(mapDetailRequests).toBeGreaterThan(0);

    const socialButton = page.locator('.sidebar button[title="Community"], .sidebar button:has-text("Community")').first();
    await socialButton.click();
    await expect(page.locator('.panel-title')).toContainText('Community');

    await page.getByRole('button', { name: /report/i }).first().click();

    const reportModal = page.locator('.modal');
    await expect(reportModal).toContainText('Report post');
    await reportModal.locator('textarea').fill('This post contains misleading aid information.');

    await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes('/api/social/posts/501/reports')
        && response.request().method() === 'POST'
        && response.status() === 200),
      reportModal.getByRole('button', { name: /submit report/i }).click(),
    ]);

    expect(reportedReason).toBe('This post contains misleading aid information.');
    await expect(page.locator('.modal h2').filter({ hasText: 'Report post' })).toHaveCount(0);
  });
});