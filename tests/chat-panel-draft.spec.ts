import { expect, test } from '@playwright/test';

const UI_BASE_URL = process.env.UI_BASE_URL ?? 'http://127.0.0.1:5173';

test.describe('Chat panel draft reset', () => {
  test('new chat clears draft text and pending image preview', async ({ page }) => {
    let authMeRequests = 0;

    await page.addInitScript(() => {
      localStorage.setItem('rc-welcome-seen', 'true');
      localStorage.setItem('rc-locale', 'en');
      localStorage.setItem('token', 'chat-ui-token');
      localStorage.removeItem('user');
    });

    await page.route('**/api/auth/me', async (route) => {
      authMeRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'chat-user-1',
          userName: 'chat-ui',
          email: 'chat-ui@example.com',
          fullName: 'Chat UI User',
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
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto(UI_BASE_URL);

    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.sidebar .sidebar-nav-danger')).toBeVisible();
    expect(authMeRequests).toBeGreaterThan(0);

    const chatButton = page.locator('.sidebar button[title="AI Chatbot"], .sidebar button:has-text("AI Chatbot")').first();
    await chatButton.click();

    const chatPanel = page.locator('.chat-panel');
    await expect(chatPanel).toBeVisible();

    const chatInput = chatPanel.locator('.chat-panel-input');
    await chatInput.fill('Need support with food packs');

    await chatPanel.locator('input[type="file"]').setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAGgwJ/lzzakQAAAABJRU5ErkJggg==', 'base64'),
    });

    await expect(chatPanel.locator('.chat-panel-image-preview')).toBeVisible();
    await expect(chatInput).toHaveValue('Need support with food packs');

    await chatPanel.locator('.chat-panel-new-btn').click();

    await expect(chatPanel.locator('.chat-panel-image-preview')).toHaveCount(0);
    await expect(chatInput).toHaveValue('');
    await expect(chatPanel.locator('.chat-panel-empty')).toBeVisible();
  });
});