import { test as base, expect, Page } from '@playwright/test';

type AdminFixtures = {
  adminToken: string;
  adminPage: Page;
};

export const test = base.extend<AdminFixtures>({
  adminToken: async ({ request }, use) => {
    const email = process.env.ADMIN_EMAIL ?? 'admin_test@reliefconnect.vn';
    const password = process.env.ADMIN_PASSWORD ?? 'Admin@123';
    const res = await request.post('http://127.0.0.1:5164/api/auth/login', {
      data: { email, password },
    });
    const data = await res.json();
    await use(data.token ?? '');
  },

  adminPage: async ({ page, adminToken }, use) => {
    await page.goto('/');
    await page.evaluate((tok) => localStorage.setItem('token', tok), adminToken);
    await page.goto('/admin');
    await page.waitForSelector('.admin-sidebar, .admin-nav, [class*="admin"]', { timeout: 10000 });
    await use(page);
  },
});

export { expect };
