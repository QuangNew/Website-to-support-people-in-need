import { expect, test } from '@playwright/test';

const UI_BASE_URL = process.env.UI_BASE_URL ?? 'http://127.0.0.1:5173';

test.describe('Chat panel error messaging', () => {
  test('shows the backend error message when sending a chat message fails', async ({ page }) => {
    let authMeRequests = 0;

    await page.addInitScript(() => {
      localStorage.setItem('rc-welcome-seen', 'true');
      localStorage.setItem('rc-locale', 'en');
      localStorage.setItem('token', 'chat-ui-token');
      localStorage.removeItem('user');
      localStorage.setItem('chatpanel_conversation_id', '777');
      localStorage.setItem('chatpanel_messages', JSON.stringify([
        {
          id: 1,
          role: 'assistant',
          content: 'Hello! I am ReliefConnect\'s AI assistant. I can help you find relief information, guide you through the platform, or answer questions. Ask me anything!',
          timestamp: '2026-04-19T00:00:00Z',
        },
      ]));
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

    await page.route(/\/api\/chatbot\/conversations\/777\/messages$/, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
        return;
      }

      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'AI provider temporarily unavailable.' }),
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
    await chatInput.fill('Trigger the backend error state');
    await chatPanel.locator('.chat-panel-send-btn').click();

    await expect(chatPanel).toContainText('AI provider temporarily unavailable.', { timeout: 10000 });
    await expect(chatPanel.locator('.chat-panel-typing')).toHaveCount(0);
  });
});