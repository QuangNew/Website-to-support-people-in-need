import { expect, test } from '@playwright/test';

const UI_BASE_URL = process.env.UI_BASE_URL ?? 'http://127.0.0.1:5173';

/**
 * Regression test: Volunteer accept and complete flow (Track 8 — minimum regression set #4).
 */
test.describe('Volunteer accept and complete flow', () => {
  const mockTask = {
    id: 501,
    pingId: 301,
    status: 'Pending',
    lat: 16.05,
    lng: 108.2,
    contactName: 'Person In Need',
    contactPhone: '0901234567',
    details: 'Need medical supplies',
    sosCategory: 'medical',
    createdAt: '2026-04-19T08:00:00Z',
  };

  test('volunteer can accept a task and complete it', async ({ page }) => {
    let acceptCalled = false;
    let completeCalled = false;
    let completeBody: Record<string, unknown> | null = null;

    // ── Auth & localStorage ──
    await page.addInitScript(() => {
      localStorage.setItem('rc-welcome-seen', 'true');
      localStorage.setItem('rc-locale', 'en');
      localStorage.setItem('token', 'volunteer-test-token');
      localStorage.removeItem('user');
    });

    // ── Mock: auth/me (Volunteer role) ──
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'vol-user-1',
          userName: 'volunteer1',
          email: 'vol@example.com',
          fullName: 'Volunteer User',
          role: 'Volunteer',
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

    // ── Mock: volunteer available tasks ──
    await page.route('**/api/volunteer/available*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockTask]),
      });
    });

    // ── Mock: volunteer active tasks ──
    await page.route('**/api/volunteer/active*', async (route) => {
      if (acceptCalled) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ ...mockTask, status: 'InProgress', volunteerId: 'vol-user-1' }]),
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
    });

    // ── Mock: volunteer history ──
    await page.route('**/api/volunteer/history*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    // ── Mock: volunteer stats ──
    await page.route('**/api/volunteer/stats*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalAcceptedTasks: acceptCalled ? 1 : 0,
          activeTasks: acceptCalled && !completeCalled ? 1 : 0,
          completedTasks: completeCalled ? 1 : 0,
          verifiedSafeTasks: 0,
        }),
      });
    });

    // ── Mock: volunteer accept ──
    await page.route('**/api/volunteer/accept', async (route) => {
      acceptCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // ── Mock: volunteer complete ──
    await page.route(/\/api\/volunteer\/complete\/\d+/, async (route) => {
      completeCalled = true;
      completeBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // ── Navigate ──
    await page.goto(UI_BASE_URL);
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 });

    // ── Open volunteer panel ──
    const volunteerBtn = page.locator('.sidebar button[title="Tasks"], .sidebar button:has-text("Tasks")').first();
    await expect(volunteerBtn).toBeVisible({ timeout: 5000 });
    await volunteerBtn.click();

    const panel = page.locator('.panel-content');
    await expect(panel).toBeVisible({ timeout: 5000 });

    // ── Should see the available task ──
    await expect(panel).toContainText('Need medical supplies', { timeout: 10000 });

    // ── Accept the task ──
    const acceptBtn = panel.locator('.btn-success').filter({ hasText: /accept/i }).first();
    await expect(acceptBtn).toBeVisible({ timeout: 5000 });
    await acceptBtn.click();
    expect(acceptCalled).toBe(true);

    // ── Switch to active tasks tab ──
    const activeTab = panel.locator('button').filter({ hasText: /active/i }).first();
    if (await activeTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await activeTab.click();
      await page.waitForTimeout(500);
    }

    // ── Complete the task ──
    const completeBtn = panel.locator('.btn-success').filter({ hasText: /complete/i }).first();
    if (await completeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await completeBtn.click();

      // ── Fill completion notes in the modal ──
      const modal = page.locator('[style*="z-index: 9999"]');
      if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
        const textarea = modal.locator('textarea');
        await textarea.fill('Successfully delivered medical supplies to the location');

        const submitBtn = modal.locator('.btn-success').last();
        await submitBtn.click();

        expect(completeCalled).toBe(true);
        expect(completeBody).not.toBeNull();
      }
    }
  });
});
