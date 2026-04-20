import { expect, test, type APIRequestContext } from '@playwright/test';

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:5164';
const adminEmail = process.env.ADMIN_EMAIL ?? 'admin_test@reliefconnect.vn';
const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin@123';

type RegisteredUser = {
  email: string;
  password: string;
  userId: string;
  token: string;
};

function apiUrl(path: string): string {
  return `${apiBaseUrl}${path}`;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function parseJson(response: { json(): Promise<unknown> }) {
  return response.json() as Promise<Record<string, unknown>>;
}

async function login(request: APIRequestContext, email: string, password: string): Promise<string> {
  const response = await request.post(apiUrl('/api/auth/login'), {
    data: { email, password },
  });

  expect(response.ok()).toBeTruthy();
  const payload = await parseJson(response);
  return String(payload.token);
}

async function registerUser(request: APIRequestContext, prefix: string, fullName: string): Promise<RegisteredUser> {
  const seed = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `${prefix}${seed}@example.com`;
  const password = 'Password123';
  const username = `${prefix}${seed}`.slice(0, 30);

  const response = await request.post(apiUrl('/api/auth/register'), {
    data: { username, email, password, fullName },
  });

  expect(response.ok()).toBeTruthy();
  const payload = await parseJson(response);

  return {
    email,
    password,
    userId: String(payload.userId),
    token: String(payload.token),
  };
}

async function approveRole(request: APIRequestContext, adminToken: string, userId: string, role: string): Promise<void> {
  const response = await request.put(apiUrl(`/api/admin/users/${userId}/role`), {
    headers: authHeaders(adminToken),
    data: { role },
  });

  expect(response.ok()).toBeTruthy();
}

test.describe('Map API', () => {
  let reporterToken: string;
  let volunteerToken: string;
  let createdPingId: number;

  test.beforeAll(async ({ request }) => {
    const adminToken = await login(request, adminEmail, adminPassword);
    const reporter = await registerUser(request, 'mapreporter', 'Map Test Reporter');
    const volunteer = await registerUser(request, 'mapvolunteer', 'Map Volunteer');

    reporterToken = reporter.token;
    await approveRole(request, adminToken, volunteer.userId, 'Volunteer');
    volunteerToken = await login(request, volunteer.email, volunteer.password);
  });

  test('create SOS ping requires contact name and phone', async ({ request }) => {
    const response = await request.post(apiUrl('/api/map/pings'), {
      headers: authHeaders(reporterToken),
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

  test('create SOS ping with required contact fields returns redacted creator response', async ({ request }) => {
    const response = await request.post(apiUrl('/api/map/pings'), {
      headers: authHeaders(reporterToken),
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
    const data = await parseJson(response);
    createdPingId = Number(data.id);
    expect(data.contactName).toBe('Map Test Reporter');
    expect(data.contactPhone ?? null).toBeNull();
    expect(data.contactEmail ?? null).toBeNull();
  });

  test('get all pings with radius query', async ({ request }) => {
    const response = await request.get(apiUrl('/api/map/pings?lat=10.762622&lng=106.660172&radiusKm=10'));
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('public ping detail redacts phone and email but keeps name', async ({ request }) => {
    const response = await request.get(apiUrl(`/api/map/pings/${createdPingId}`));
    expect(response.ok()).toBeTruthy();
    const data = await parseJson(response);
    expect(data.contactName).toBe('Map Test Reporter');
    expect(data.contactPhone ?? null).toBeNull();
    expect(data.contactEmail ?? null).toBeNull();
  });

  test('volunteer ping detail reveals sensitive contact', async ({ request }) => {
    const response = await request.get(apiUrl(`/api/map/pings/${createdPingId}`), {
      headers: authHeaders(volunteerToken),
    });

    expect(response.ok()).toBeTruthy();
    const data = await parseJson(response);
    expect(data.contactName).toBe('Map Test Reporter');
    expect(data.contactPhone).toBe('0901234567');
    expect(String(data.contactEmail)).toContain('@example.com');
  });
});
