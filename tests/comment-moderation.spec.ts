import { expect, test } from '@playwright/test';

const UI_BASE_URL = process.env.UI_BASE_URL ?? 'http://127.0.0.1:5173';

/**
 * Regression test: Comment hide and restore (Track 8 — minimum regression set #6).
 *
 * Tests the admin hide-comment flow via the social panel.
 */
test.describe('Comment moderation — hide and restore', () => {
  const mockPost = {
    id: 801,
    content: 'We need volunteers at Hue shelter',
    authorId: 'author-1',
    authorName: 'Post Author',
    authorAvatarUrl: null,
    imageUrl: null,
    category: 'Livelihood',
    commentCount: 1,
    reactionSummary: {},
    userReaction: null,
    createdAt: '2026-04-19T06:00:00Z',
  };

  const mockComment = {
    id: 901,
    content: 'This is a comment that violates guidelines',
    userId: 'commenter-1',
    userName: 'Commenter User',
    userAvatarUrl: null,
    createdAt: '2026-04-19T07:00:00Z',
  };

  test('admin can hide a comment from the social panel', async ({ page }) => {
    let hideCommentCalled = false;
    let hidePayload: Record<string, unknown> | null = null;

    // ── Auth & localStorage ──
    await page.addInitScript(() => {
      localStorage.setItem('rc-welcome-seen', 'true');
      localStorage.setItem('rc-locale', 'en');
      localStorage.setItem('token', 'admin-test-token');
      localStorage.removeItem('user');
    });

    // ── Mock: auth/me (Admin role) ──
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'admin-user-1',
          userName: 'admin1',
          email: 'admin@example.com',
          fullName: 'Admin User',
          role: 'Admin',
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

    // ── Mock: social posts ──
    await page.route('**/api/social/posts?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [mockPost],
          nextCursor: null,
        }),
      });
    });

    await page.route('**/api/social/posts', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [mockPost],
            nextCursor: null,
          }),
        });
        return;
      }
      await route.continue();
    });

    // ── Mock: comments for the post ──
    await page.route(/\/api\/social\/posts\/801\/comments/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [mockComment],
          nextCursor: null,
        }),
      });
    });

    // ── Mock: hide comment API ──
    await page.route(/\/api\/admin\/moderation\/posts\/801\/comments\/901\/hide/, async (route) => {
      hideCommentCalled = true;
      hidePayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // ── Navigate ──
    await page.goto(UI_BASE_URL);
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 });

    // ── Open social panel ──
    const socialBtn = page.locator('.sidebar button[title="Community"], .sidebar button:has-text("Community")').first();
    await expect(socialBtn).toBeVisible({ timeout: 5000 });
    await socialBtn.click();

    const panel = page.locator('.panel-content');
    await expect(panel).toBeVisible({ timeout: 5000 });

    // ── Should see the post ──
    await expect(panel).toContainText('We need volunteers at Hue shelter', { timeout: 10000 });

    // ── Toggle comments ──
    const commentToggle = panel.locator('.social-action-btn').filter({ hasText: /comment|1/i }).first();
    await commentToggle.click();

    // ── Should see the comment ──
    await expect(panel).toContainText('violates guidelines', { timeout: 5000 });

    // ── Click hide button (EyeOff icon — admin only) ──
    const hideBtn = panel.locator('button[title*="Hide"], button[title*="hide"]').first();
    await expect(hideBtn).toBeVisible({ timeout: 5000 });
    await hideBtn.click();

    // ── HideCommentModal should appear ──
    const modal = page.locator('.modal-overlay, [class*="modal"]').first();
    await expect(modal).toBeVisible({ timeout: 3000 });

    // ── Fill reason ──
    const reasonTextarea = modal.locator('textarea');
    await reasonTextarea.fill('This comment violates community guidelines about respectful communication');

    // ── Submit ──
    const submitBtn = modal.locator('.btn-danger');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // ── Verify API was called ──
    await expect.poll(() => hideCommentCalled, { timeout: 5000 }).toBe(true);
    expect(hidePayload).not.toBeNull();
    expect(hidePayload!.reason).toContain('violates community guidelines');
    expect(hidePayload!.durationDays).toBe(30); // default
    expect(hidePayload!.notifyUser).toBe(true); // default
  });
});
