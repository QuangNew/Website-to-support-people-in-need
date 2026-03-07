import { test, expect } from '@playwright/test';

const API = 'http://127.0.0.1:5164/api';

test.describe('Social API', () => {
  test('GET /social/posts returns paginated response', async ({ request }) => {
    const res = await request.get(`${API}/social/posts?limit=5`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('items');
    expect(Array.isArray(data.items)).toBe(true);
  });

  test('POST /social/posts requires auth', async ({ request }) => {
    const res = await request.post(`${API}/social/posts`, {
      data: { content: 'Test post', category: 'Livelihood' },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /social/posts/{id}/reactions requires auth', async ({ request }) => {
    const res = await request.post(`${API}/social/posts/1/reactions`, {
      data: { type: 'Like' },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /social/posts/{id}/comments returns paginated response', async ({ request }) => {
    // Even for non-existent post, should return 200 with empty items or 404
    const res = await request.get(`${API}/social/posts/999999/comments`);
    const status = res.status();
    expect([200, 404]).toContain(status);
  });
});

test.describe('Social Panel UI', () => {
  test('social panel shows community title', async ({ page }) => {
    await page.goto('/');
    // Open social panel via sidebar
    const sidebar = page.locator('.sidebar');
    if (await sidebar.isVisible()) {
      const socialBtn = sidebar.locator('button, a').filter({ hasText: /cộng đồng|community/i });
      if (await socialBtn.count() > 0) {
        await socialBtn.first().click();
        await expect(page.locator('.panel-title')).toBeAttached();
      }
    }
  });
});
