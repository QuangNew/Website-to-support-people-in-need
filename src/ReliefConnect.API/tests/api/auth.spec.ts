import { test, expect } from '@playwright/test';
import { ApiHelper } from '../helpers/api-helper';

test.describe('Auth API', () => {
  let api: ApiHelper;

  test.beforeEach(async ({ request }) => {
    api = new ApiHelper(request);
  });

  test('register new user', async ({ request }) => {
    const email = `test${Date.now()}@example.com`;
    const response = await api.register(email, 'Password123', 'PersonInNeed');
    expect(response.ok()).toBeTruthy();
  });

  test('login with valid credentials', async ({ request }) => {
    const email = `test${Date.now()}@example.com`;
    await api.register(email, 'Password123', 'PersonInNeed');
    const token = await api.login(email, 'Password123');
    expect(token).toBeTruthy();
  });

  test('login fails with invalid credentials', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: 'invalid@example.com', password: 'wrong' },
    });
    expect(response.status()).toBe(401);
  });

  test('get current user info', async ({ request }) => {
    const email = `test${Date.now()}@example.com`;
    await api.register(email, 'Password123', 'PersonInNeed');
    const token = await api.login(email, 'Password123');

    const response = await request.get('/api/auth/me', {
      headers: await api.createAuthHeaders(token),
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.email).toBe(email);
  });
});
