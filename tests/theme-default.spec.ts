import { expect, test } from '@playwright/test';

test.describe('Theme initialization', () => {
  test('uses light theme for a first-time visitor', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('rc-theme');
      localStorage.setItem('rc-welcome-seen', 'true');
    });
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('rc-theme'))).toBe('light');
  });

  test('preserves an existing dark preference', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('rc-theme', 'dark');
      localStorage.setItem('rc-welcome-seen', 'true');
    });
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
