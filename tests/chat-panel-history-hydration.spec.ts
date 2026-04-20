import { expect, test } from '@playwright/test';

const UI_BASE_URL = process.env.UI_BASE_URL ?? 'http://127.0.0.1:5173';

test.describe('Chat panel history hydration', () => {
  test('hydrates conversation history from the backend when local cache is missing', async ({ page }) => {
    let authMeRequests = 0;
    let getMessagesCalls = 0;

    await page.addInitScript(() => {
      localStorage.setItem('rc-welcome-seen', 'true');
      localStorage.setItem('rc-locale', 'en');
      localStorage.setItem('token', 'chat-ui-token');
      localStorage.removeItem('user');
      localStorage.setItem('chatpanel_conversation_id', '456');
      localStorage.removeItem('chatpanel_messages');
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

    await page.route(/\/api\/chatbot\/conversations\/456\/messages$/, async (route) => {
      getMessagesCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 41,
            content: 'I need directions to the nearest shelter.',
            isBotMessage: false,
            hasSafetyWarning: false,
            sentAt: '2026-04-19T00:00:00Z',
          },
          {
            id: 42,
            content: 'The nearest shelter is 2 km away and can be reached via the east bridge.',
            isBotMessage: true,
            hasSafetyWarning: false,
            sentAt: '2026-04-19T00:01:00Z',
          },
        ]),
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
    await expect.poll(() => getMessagesCalls, { timeout: 10000 }).toBeGreaterThan(0);
    await expect(chatPanel).toContainText('I need directions to the nearest shelter.', { timeout: 10000 });
    await expect(chatPanel).toContainText('The nearest shelter is 2 km away and can be reached via the east bridge.', { timeout: 10000 });
    await expect(chatPanel.locator('.chat-panel-empty')).toHaveCount(0);
    expect(getMessagesCalls).toBeGreaterThan(0);
  });
});