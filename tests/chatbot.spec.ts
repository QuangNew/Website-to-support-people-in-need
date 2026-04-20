import { test, expect } from '@playwright/test';

const API_URL = 'http://127.0.0.1:5164/api';
const UI_BASE_URL = process.env.UI_BASE_URL ?? 'http://127.0.0.1:5173';

test.describe('Chatbot', () => {
  test('API: Create conversation requires auth', async ({ request }) => {
    const response = await request.post(`${API_URL}/chatbot/conversations`);
    expect(response.status()).toBe(401);
  });

  test('API: Create conversation and send message', async ({ request }) => {
    // Login first
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { email: 'admin_test@reliefconnect.vn', password: 'Admin@123' },
    });
    if (loginRes.status() !== 200) {
      test.skip(true, 'Test account not available');
      return;
    }
    const { token } = await loginRes.json();

    // Create conversation
    const convRes = await request.post(`${API_URL}/chatbot/conversations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(convRes.status()).toBe(200);
    const { id: conversationId } = await convRes.json();
    expect(conversationId).toBeGreaterThan(0);

    // Send message
    const msgRes = await request.post(`${API_URL}/chatbot/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { content: 'Xin chào, tôi cần giúp đỡ' },
    });
    expect(msgRes.status()).toBe(200);
    const msg = await msgRes.json();
    expect(msg.content).toBeTruthy();
    expect(msg.isBotMessage).toBe(true);
  });

  test('UI: Chat panel shows on sidebar click', async ({ page }) => {
    await page.goto(UI_BASE_URL);
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10000 });
    const chatBtn = page.locator('.sidebar button[title="AI Chatbot"], .sidebar button:has-text("AI Chatbot")').first();
    if (await chatBtn.isVisible()) {
      await chatBtn.click();
      await expect(page.locator('.chat-panel').first()).toBeVisible({ timeout: 5000 });
      await expect(page.locator('.chat-panel-msg--assistant').first()).toBeVisible();
    }
  });
});
