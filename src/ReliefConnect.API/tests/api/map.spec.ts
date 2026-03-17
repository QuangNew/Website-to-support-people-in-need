import { test, expect } from '@playwright/test';
import { ApiHelper } from '../helpers/api-helper';

test.describe('Map API', () => {
  let api: ApiHelper;
  let token: string;

  test.beforeAll(async ({ request }) => {
    api = new ApiHelper(request);
    const email = `maptest${Date.now()}@example.com`;
    await api.register(email, 'Password123', 'PersonInNeed');
    token = await api.login(email, 'Password123');
  });

  test('create SOS ping', async ({ request }) => {
    const response = await request.post('/api/map/pings', {
      headers: await api.createAuthHeaders(token),
      data: {
        latitude: 10.762622,
        longitude: 106.660172,
        description: 'Need urgent help',
        category: 'Medical',
      },
    });
    expect(response.ok()).toBeTruthy();
  });

  test('get all pings', async ({ request }) => {
    const response = await request.get('/api/map/pings');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('get pings within bounds', async ({ request }) => {
    const response = await request.get('/api/map/pings/bounds?minLat=10&maxLat=11&minLng=106&maxLng=107');
    expect(response.ok()).toBeTruthy();
  });
});
