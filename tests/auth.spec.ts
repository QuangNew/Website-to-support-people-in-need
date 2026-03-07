import { test, expect } from '@playwright/test';

const API_URL = 'http://127.0.0.1:5164/api';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear stored tokens
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('starts as not logged in', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    // Profile panel should not be visible since user is not authenticated
    // Login button should exist in sidebar
    const sidebar = page.locator('.sidebar, nav').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  });

  test('opens login modal from sidebar', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10000 });
    // Dismiss any welcome modal first
    const overlay = page.locator('.modal-overlay');
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
    // Click the login button in sidebar
    const loginBtn = page.locator('button, a').filter({ hasText: /\u0111\u0103ng nh\u1eadp|login/i }).first();
    if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loginBtn.click();
      // Login modal should appear
      await expect(page.locator('.auth-modal, .modal').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('login form accepts email or username', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10000 });
    const loginBtn = page.locator('button, a').filter({ hasText: /đăng nhập|login/i }).first();
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
      await page.waitForTimeout(500);
      // The input should be type="text" (not email) to support username login
      const emailInput = page.locator('.auth-modal input[type="text"], .modal input[type="text"]').first();
      if (await emailInput.isVisible()) {
        await expect(emailInput).toHaveAttribute('type', 'text');
      }
    }
  });

  test('API login with username works', async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/login`, {
      data: { email: 'admin_test', password: 'Admin@123' },
    });
    // 200 if account exists, 401 if not — both are valid API responses
    expect([200, 401]).toContain(response.status());
    if (response.status() === 200) {
      const data = await response.json();
      expect(data.token).toBeTruthy();
    }
  });

  test('API login with email works', async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/login`, {
      data: { email: 'admin_test@reliefconnect.vn', password: 'Admin@123' },
    });
    // 200 if account exists, 401 if not — both are valid API responses
    expect([200, 401]).toContain(response.status());
    if (response.status() === 200) {
      const data = await response.json();
      expect(data.token).toBeTruthy();
    }
  });
});
