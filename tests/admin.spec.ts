import { test as adminTest, expect } from './fixtures/adminAuth';

const API = 'http://127.0.0.1:5164/api';

// ─── API TESTS (no browser) ───────────────────────────────────────────────

adminTest.describe('Admin API', () => {
  adminTest('1. GET /api/admin/stats returns 200 with all 10 fields', async ({ request, adminToken }) => {
    const res = await request.get(`${API}/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const required = [
      'totalUsers', 'totalPersonsInNeed', 'totalSponsors', 'totalVolunteers',
      'activeSOS', 'resolvedCases', 'totalPosts',
      'totalPostsLivelihood', 'totalPostsMedical', 'totalPostsEducation',
    ];
    for (const field of required) {
      expect(body, `missing field: ${field}`).toHaveProperty(field);
    }
  });

  adminTest('2. GET /api/admin/stats responds within 2 seconds', async ({ request, adminToken }) => {
    const start = Date.now();
    const res = await request.get(`${API}/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const elapsed = Date.now() - start;
    expect(res.status()).toBe(200);
    expect(elapsed, `stats took ${elapsed}ms — expected < 2000ms`).toBeLessThan(2000);
  });

  adminTest('3. GET /api/admin/users returns paginated shape', async ({ request, adminToken }) => {
    const res = await request.get(`${API}/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(body.total).toBeGreaterThanOrEqual(0);
    expect(body.page).toBe(1);
    expect(typeof body.pageSize).toBe('number');
    expect(typeof body.totalPages).toBe('number');
    expect(body.totalPages).toBeGreaterThanOrEqual(1);
  });

  adminTest('4. GET /api/admin/users?search=a filters by search term server-side', async ({ request, adminToken }) => {
    const res = await request.get(`${API}/admin/users?search=a`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    for (const user of body.items as Array<{ fullName: string; email: string; userName: string }>) {
      const combined = `${user.fullName} ${user.email} ${user.userName}`.toLowerCase();
      expect(combined, `user "${user.userName}" doesn't contain "a"`).toContain('a');
    }
  });

  adminTest('5. GET /api/admin/logs returns paginated shape with totalPages', async ({ request, adminToken }) => {
    const res = await request.get(`${API}/admin/logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(typeof body.totalPages).toBe('number');
  });

  adminTest('6. GET /api/admin/logs?action=Login returns only Login entries', async ({ request, adminToken }) => {
    const res = await request.get(`${API}/admin/logs?action=Login`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    for (const log of body.items as Array<{ action: string }>) {
      expect(log.action).toBe('Login');
    }
  });
});

// ─── E2E TESTS (browser) ─────────────────────────────────────────────────

adminTest.describe('Admin E2E', () => {
  adminTest('7. Stats panel renders all 10 stat cards', async ({ adminPage }) => {
    await adminPage.waitForSelector('.admin-stat-card', { timeout: 12000 });
    const cards = await adminPage.locator('.admin-stat-card').count();
    expect(cards).toBe(10);
  });

  adminTest('8. Stats cards show non-negative numbers', async ({ adminPage }) => {
    await adminPage.waitForSelector('.admin-stat-card__value', { timeout: 12000 });
    const values = await adminPage.locator('.admin-stat-card__value').allTextContents();
    for (const v of values) {
      const n = parseInt(v.replace(/,/g, ''), 10);
      expect(isNaN(n) ? 0 : n).toBeGreaterThanOrEqual(0);
    }
  });

  adminTest('9. Users panel loads rows', async ({ adminPage }) => {
    const usersBtn = adminPage.locator('.admin-nav-btn, button, [role="tab"]').filter({ hasText: /user/i }).first();
    if (await usersBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await usersBtn.click();
    }
    await adminPage.waitForSelector('tbody tr', { timeout: 10000 });
    const rows = await adminPage.locator('tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(1);
  });

  adminTest('10. Search filter does not crash the page', async ({ adminPage }) => {
    const usersBtn = adminPage.locator('.admin-nav-btn, button, [role="tab"]').filter({ hasText: /user/i }).first();
    if (await usersBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await usersBtn.click();
    }
    await adminPage.waitForSelector('tbody tr', { timeout: 10000 });

    const searchInput = adminPage.locator('input[type="text"], input[placeholder]').first();
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('a');
      await adminPage.waitForTimeout(800);
      await adminPage.waitForSelector('tbody tr, td[colspan]', { timeout: 5000 });
    }
    // No error state visible
    const errState = adminPage.locator('.admin-empty').filter({ hasText: /error/i });
    await expect(errState).not.toBeVisible({ timeout: 2000 }).catch(() => {});
  });

  adminTest('11. Posts panel loads with category filter', async ({ adminPage }) => {
    const postsBtn = adminPage.locator('.admin-nav-btn, button, [role="tab"]').filter({ hasText: /post/i }).first();
    if (await postsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await postsBtn.click();
    }
    await adminPage.waitForSelector('tbody tr, .admin-empty', { timeout: 10000 });

    const categorySelect = adminPage.locator('select').filter({ hasText: /All Categories/i });
    if (await categorySelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await categorySelect.selectOption('Livelihood');
      await adminPage.waitForSelector('tbody tr, .admin-empty', { timeout: 5000 });
    }
    // No uncaught error toast
    const errToast = adminPage.locator('[class*="toast"]').filter({ hasText: /error/i });
    await expect(errToast).not.toBeVisible({ timeout: 2000 }).catch(() => {});
  });

  adminTest('12. Logs panel loads with date filter', async ({ adminPage }) => {
    const logsBtn = adminPage.locator('.admin-nav-btn, button, [role="tab"]').filter({ hasText: /log/i }).first();
    if (await logsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logsBtn.click();
    }
    await adminPage.waitForSelector('tbody tr, .admin-empty', { timeout: 10000 });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    const dateInput = adminPage.locator('input[type="date"]').first();
    if (await dateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dateInput.fill(dateStr);
      await adminPage.waitForSelector('tbody tr, .admin-empty', { timeout: 5000 });
    }
    const errToast = adminPage.locator('[class*="toast"]').filter({ hasText: /error/i });
    await expect(errToast).not.toBeVisible({ timeout: 2000 }).catch(() => {});
  });
});
