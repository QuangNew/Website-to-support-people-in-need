import { test, expect } from '@playwright/test';
import { ApiHelper } from '../helpers/api-helper';

test.describe('Admin API', () => {
  let api: ApiHelper;
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    api = new ApiHelper(request);
    const email = `admin${Date.now()}@example.com`;
    await api.register(email, 'Password123', 'Admin');
    adminToken = await api.login(email, 'Password123');
  });

  test('get all users', async ({ request }) => {
    const response = await request.get('/api/admin/users', {
      headers: await api.createAuthHeaders(adminToken),
    });
    expect(response.ok()).toBeTruthy();
  });

  test('verify user', async ({ request }) => {
    const email = `user${Date.now()}@example.com`;
    await api.register(email, 'Password123', 'PersonInNeed');

    const usersRes = await request.get('/api/admin/users', {
      headers: await api.createAuthHeaders(adminToken),
    });
    const users = await usersRes.json();
    const user = users.find((u: any) => u.email === email);

    const response = await request.post(`/api/admin/users/${user.id}/verify`, {
      headers: await api.createAuthHeaders(adminToken),
    });
    expect(response.ok()).toBeTruthy();
  });

  test('get statistics', async ({ request }) => {
    const response = await request.get('/api/admin/statistics', {
      headers: await api.createAuthHeaders(adminToken),
    });
    expect(response.ok()).toBeTruthy();
  });
});
