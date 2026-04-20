import { expect, test } from '@playwright/test';

const UI_BASE_URL = process.env.UI_BASE_URL ?? 'http://127.0.0.1:5173';

test.describe('Chat panel stale conversation recovery', () => {
  test('recreates the conversation and retries when cached conversation id is stale', async ({ page }) => {
    let authMeRequests = 0;
    let createConversationCalls = 0;
    const sendAttempts: number[] = [];

    await page.addInitScript(() => {
      localStorage.setItem('rc-welcome-seen', 'true');
      localStorage.setItem('rc-locale', 'en');
      localStorage.setItem('token', 'chat-ui-token');
      localStorage.removeItem('user');
      localStorage.setItem('chatpanel_conversation_id', '123');
      localStorage.setItem('chatpanel_messages', JSON.stringify([
        {
          id: 1,
          role: 'assistant',
          content: 'Hello! I am ReliefConnect\'s AI assistant. I can help you find relief information, guide you through the platform, or answer questions. Ask me anything!',
          timestamp: '2026-04-19T00:00:00Z',
        },
        {
          id: 2,
          role: 'user',
          content: 'Previous cached message',
          timestamp: '2026-04-19T00:01:00Z',
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

    await page.route(/\/api\/chatbot\/conversations(?:\/\d+\/messages)?\/?(?:\?.*)?$/, async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === 'POST' && /\/api\/chatbot\/conversations\/?$/.test(url.pathname)) {
        createConversationCalls += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 49001 }),
        });
        return;
      }

      if (request.method() === 'POST' && /\/api\/chatbot\/conversations\/\d+\/messages$/.test(url.pathname)) {
        const conversationId = Number(url.pathname.split('/').at(-2));
        sendAttempts.push(conversationId);

        if (conversationId === 123) {
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Conversation not found.' }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 77,
            content: 'Fresh conversation created after stale cache recovery.',
            isBotMessage: true,
            hasSafetyWarning: false,
            sentAt: '2026-04-19T00:00:00Z',
          }),
        });
        return;
      }

      if (request.method() === 'GET') {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Conversation not found.' }),
        });
        return;
      }

      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unexpected chatbot request in stale conversation test.' }),
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
    await chatInput.fill('Retry the stale conversation');
    await chatPanel.locator('.chat-panel-send-btn').click();

    await expect(chatPanel).toContainText('Fresh conversation created after stale cache recovery.', { timeout: 10000 });
    expect(sendAttempts.length).toBeGreaterThan(0);
    expect(sendAttempts[0]).toBe(123);

    const storedConversationId = await page.evaluate(() => localStorage.getItem('chatpanel_conversation_id'));
    expect(storedConversationId).not.toBeNull();
    expect(storedConversationId).not.toBe('123');
  });
});