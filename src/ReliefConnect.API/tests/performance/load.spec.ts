import { test, expect } from '@playwright/test';
import { ApiHelper } from '../helpers/api-helper';

test.describe('Backend Performance Tests', () => {
  let api: ApiHelper;
  let token: string;

  test.beforeAll(async ({ request }) => {
    api = new ApiHelper(request);
    const email = `perf${Date.now()}@example.com`;
    await api.register(email, 'Password123', 'PersonInNeed');
    token = await api.login(email, 'Password123');
  });

  test('response time - get pings', async ({ request }) => {
    const start = Date.now();
    const response = await request.get('/api/map/pings');
    const duration = Date.now() - start;

    expect(response.ok()).toBeTruthy();
    expect(duration).toBeLessThan(1000); // Should respond within 1s
  });

  test('response time - auth login', async ({ request }) => {
    const email = `speed${Date.now()}@example.com`;
    await api.register(email, 'Password123', 'PersonInNeed');

    const start = Date.now();
    await api.login(email, 'Password123');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(2000); // Auth should be fast
  });

  test('concurrent requests handling', async ({ request }) => {
    const requests = Array(10).fill(null).map(() =>
      request.get('/api/map/pings')
    );

    const start = Date.now();
    const responses = await Promise.all(requests);
    const duration = Date.now() - start;

    responses.forEach(r => expect(r.ok()).toBeTruthy());
    expect(duration).toBeLessThan(3000); // 10 concurrent requests < 3s
  });

  test('rate limiting - auth endpoint', async ({ request }) => {
    const requests = Array(15).fill(null).map(() =>
      request.post('/api/auth/login', {
        data: { email: 'test@test.com', password: 'wrong' },
      })
    );

    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.status() === 429);

    expect(rateLimited.length).toBeGreaterThan(0); // Should hit rate limit
  });

  test('large payload handling', async ({ request }) => {
    const largeDescription = 'x'.repeat(5000);
    const response = await request.post('/api/map/pings', {
      headers: await api.createAuthHeaders(token),
      data: {
        latitude: 10.762622,
        longitude: 106.660172,
        description: largeDescription,
        category: 'Other',
      },
    });

    expect(response.ok()).toBeTruthy();
  });
});
