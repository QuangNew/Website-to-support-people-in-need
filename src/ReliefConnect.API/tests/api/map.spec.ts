import { test, expect } from '@playwright/test';
import { ApiHelper } from '../helpers/api-helper';

test.describe('Map API', () => {
  let api: ApiHelper;
  let token: string;
  let createdPingId: number;

  test.beforeAll(async ({ request }) => {
    api = new ApiHelper(request);
    const email = `maptest${Date.now()}@example.com`;
    await api.register(email, 'Password123', 'Map Test User');
    token = await api.login(email, 'Password123');
  });

  test('create SOS ping requires contact name and phone', async ({ request }) => {
    const response = await request.post('/api/map/pings', {
      headers: await api.createAuthHeaders(token),
      data: {
        lat: 10.762622,
        lng: 106.660172,
        type: 'SOS',
        details: 'Need urgent help',
        sosCategory: 'medical',
      },
    });
    expect(response.status()).toBe(400);
  });

  test('create SOS ping with required contact fields', async ({ request }) => {
    const response = await request.post('/api/map/pings', {
      headers: await api.createAuthHeaders(token),
      data: {
        lat: 10.762622,
        lng: 106.660172,
        type: 'SOS',
        contactName: 'Map Test Reporter',
        contactPhone: '0901234567',
        details: 'Need urgent help',
        sosCategory: 'medical',
      },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    createdPingId = data.id;
    expect(data.contactName).toBe('Map Test Reporter');
    expect(data.contactPhone ?? null).toBeNull();
    expect(data.contactEmail ?? null).toBeNull();
  });

  test('get all pings', async ({ request }) => {
    const response = await request.get('/api/map/pings?lat=10.762622&lng=106.660172&radiusKm=10');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('public ping detail redacts phone and email but keeps name', async ({ request }) => {
    const response = await request.get(`/api/map/pings/${createdPingId}`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.contactName).toBe('Map Test Reporter');
    expect(data.contactPhone ?? null).toBeNull();
    expect(data.contactEmail ?? null).toBeNull();
  });
});
