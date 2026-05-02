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

async function createSos(request: APIRequestContext, token: string, details: string): Promise<number> {
  const response = await request.post(apiUrl('/api/map/pings'), {
    headers: authHeaders(token),
    data: {
      lat: 10.762622,
      lng: 106.660172,
      type: 'SOS',
      contactName: 'Role Flow Reporter',
      contactPhone: '0901234567',
      details,
      sosCategory: 'medical',
    },
  });

  expect(response.status()).toBe(201);
  const payload = await parseJson(response);
  return Number(payload.id);
}

async function getNotifications(request: APIRequestContext, token: string): Promise<Array<Record<string, unknown>>> {
  const response = await request.get(apiUrl('/api/notifications?page=1&pageSize=50'), {
    headers: authHeaders(token),
  });

  expect(response.ok()).toBeTruthy();
  const payload = await parseJson(response);
  return (payload.items as Array<Record<string, unknown>> | undefined) ?? [];
}

async function getMe(request: APIRequestContext, token: string) {
  return request.get(apiUrl('/api/auth/me'), {
    headers: authHeaders(token),
  });
}

test.describe('Role workflows API', () => {
  test('volunteer flow enforces task ownership and completion transitions', async ({ request }) => {
    const adminToken = await login(request, adminEmail, adminPassword);
    const person = await registerUser(request, 'personrole', 'Person Role');
    const volunteerA = await registerUser(request, 'volunteera', 'Volunteer A');
    const volunteerB = await registerUser(request, 'volunteerb', 'Volunteer B');

    await approveRole(request, adminToken, person.userId, 'PersonInNeed');
    await approveRole(request, adminToken, volunteerA.userId, 'Volunteer');
    await approveRole(request, adminToken, volunteerB.userId, 'Volunteer');

    const personToken = await login(request, person.email, person.password);
    const volunteerAToken = await login(request, volunteerA.email, volunteerA.password);
    const volunteerBToken = await login(request, volunteerB.email, volunteerB.password);

    const pingId = await createSos(request, personToken, 'Volunteer workflow SOS');

    const availableResponse = await request.get(apiUrl('/api/volunteer/tasks'), {
      headers: authHeaders(volunteerAToken),
    });
    expect(availableResponse.ok()).toBeTruthy();
    const availableTasks = await availableResponse.json() as Array<Record<string, unknown>>;
    expect(availableTasks.some((task) => Number(task.id) === pingId)).toBeTruthy();

    const acceptResponse = await request.post(apiUrl('/api/volunteer/accept-task'), {
      headers: authHeaders(volunteerAToken),
      data: { pingId },
    });
    expect(acceptResponse.ok()).toBeTruthy();

    const activeForVolunteerA = await request.get(apiUrl('/api/volunteer/active-tasks'), {
      headers: authHeaders(volunteerAToken),
    });
    expect(activeForVolunteerA.ok()).toBeTruthy();
    const activeAItems = await activeForVolunteerA.json() as Array<Record<string, unknown>>;
    expect(activeAItems.some((task) => Number(task.id) === pingId)).toBeTruthy();

    const activeForVolunteerB = await request.get(apiUrl('/api/volunteer/active-tasks'), {
      headers: authHeaders(volunteerBToken),
    });
    expect(activeForVolunteerB.ok()).toBeTruthy();
    const activeBItems = await activeForVolunteerB.json() as Array<Record<string, unknown>>;
    expect(activeBItems.some((task) => Number(task.id) === pingId)).toBeFalsy();

    const forbiddenComplete = await request.post(apiUrl(`/api/volunteer/tasks/${pingId}/complete`), {
      headers: authHeaders(volunteerBToken),
      data: { completionNotes: 'Not my task' },
    });
    expect(forbiddenComplete.status()).toBe(403);

    const completeResponse = await request.post(apiUrl(`/api/volunteer/tasks/${pingId}/complete`), {
      headers: authHeaders(volunteerAToken),
      data: { completionNotes: 'Delivered first-aid support' },
    });
    expect(completeResponse.ok()).toBeTruthy();

    const historyResponse = await request.get(apiUrl('/api/volunteer/tasks/history'), {
      headers: authHeaders(volunteerAToken),
    });
    expect(historyResponse.ok()).toBeTruthy();
    const historyItems = await historyResponse.json() as Array<Record<string, unknown>>;
    const completedTask = historyItems.find((task) => Number(task.id) === pingId);
    expect(completedTask).toBeTruthy();
    expect(completedTask?.status).toBe('Resolved');
    expect(completedTask?.completionNotes).toBe('Delivered first-aid support');

    const statsResponse = await request.get(apiUrl('/api/volunteer/stats'), {
      headers: authHeaders(volunteerAToken),
    });
    expect(statsResponse.ok()).toBeTruthy();
    const stats = await parseJson(statsResponse);
    expect(stats.totalAcceptedTasks).toBe(1);
    expect(stats.activeTasks).toBe(0);
    expect(stats.completedTasks).toBe(1);

    const notifications = await getNotifications(request, personToken);
    const messages = notifications.map((notification) => String(notification.messageText));
    expect(messages.some((message) => message.includes(`SOS #${pingId}`) && message.includes('nhận'))).toBeTruthy();
    expect(messages.some((message) => message.includes(`SOS #${pingId}`) && message.includes('hoàn thành'))).toBeTruthy();
  });

  test('sponsor flow persists offers and supports accepted or declined responses', async ({ request }) => {
    const adminToken = await login(request, adminEmail, adminPassword);
    const person = await registerUser(request, 'pinoffer', 'Person Offer');
    const sponsor = await registerUser(request, 'sponsorrole', 'Sponsor Role');

    await approveRole(request, adminToken, person.userId, 'PersonInNeed');
    await approveRole(request, adminToken, sponsor.userId, 'Sponsor');

    const personToken = await login(request, person.email, person.password);
    const sponsorToken = await login(request, sponsor.email, sponsor.password);

    const firstPingId = await createSos(request, personToken, 'Sponsor workflow SOS A');
    const secondPingId = await createSos(request, personToken, 'Sponsor workflow SOS B');

    const casesResponse = await request.get(apiUrl('/api/sponsor/cases'), {
      headers: authHeaders(sponsorToken),
    });
    expect(casesResponse.ok()).toBeTruthy();
    const casesPayload = await parseJson(casesResponse);
    const sosCases = (casesPayload.sosCases as Array<Record<string, unknown>> | undefined) ?? [];
    expect(sosCases.some((item) => Number(item.id) === firstPingId)).toBeTruthy();

    const firstOfferResponse = await request.post(apiUrl('/api/sponsor/offer-help'), {
      headers: authHeaders(sponsorToken),
      data: { pingId: firstPingId, message: 'Can deliver food kits' },
    });
    expect(firstOfferResponse.ok()).toBeTruthy();

    const duplicateOfferResponse = await request.post(apiUrl('/api/sponsor/offer-help'), {
      headers: authHeaders(sponsorToken),
      data: { pingId: firstPingId, message: 'Duplicate offer' },
    });
    expect(duplicateOfferResponse.status()).toBe(400);

    const secondOfferResponse = await request.post(apiUrl('/api/sponsor/offer-help'), {
      headers: authHeaders(sponsorToken),
      data: { pingId: secondPingId, message: 'Can deliver blankets' },
    });
    expect(secondOfferResponse.ok()).toBeTruthy();

    const personNotifications = await getNotifications(request, personToken);
    const personMessages = personNotifications.map((notification) => String(notification.messageText));
    expect(personMessages.filter((message) => message.includes('Nhà tài trợ đã đề nghị hỗ trợ')).length).toBeGreaterThanOrEqual(2);

    const incomingOffersResponse = await request.get(apiUrl('/api/person-in-need/offers'), {
      headers: authHeaders(personToken),
    });
    expect(incomingOffersResponse.ok()).toBeTruthy();
    const incomingOffers = await incomingOffersResponse.json() as Array<Record<string, unknown>>;

    const firstOffer = incomingOffers.find((offer) => Number(offer.pingId) === firstPingId);
    const secondOffer = incomingOffers.find((offer) => Number(offer.pingId) === secondPingId);
    expect(firstOffer).toBeTruthy();
    expect(secondOffer).toBeTruthy();
    expect(firstOffer?.status).toBe('Pending');
    expect(secondOffer?.status).toBe('Pending');

    const acceptOfferResponse = await request.post(apiUrl(`/api/person-in-need/offers/${Number(firstOffer?.id)}/respond`), {
      headers: authHeaders(personToken),
      data: { decision: 'Accepted' },
    });
    expect(acceptOfferResponse.ok()).toBeTruthy();

    const declineOfferResponse = await request.post(apiUrl(`/api/person-in-need/offers/${Number(secondOffer?.id)}/respond`), {
      headers: authHeaders(personToken),
      data: { decision: 'Declined' },
    });
    expect(declineOfferResponse.ok()).toBeTruthy();

    const duplicateResponseAttempt = await request.post(apiUrl(`/api/person-in-need/offers/${Number(firstOffer?.id)}/respond`), {
      headers: authHeaders(personToken),
      data: { decision: 'Accepted' },
    });
    expect(duplicateResponseAttempt.status()).toBe(400);

    const sponsorOffersResponse = await request.get(apiUrl('/api/sponsor/offers'), {
      headers: authHeaders(sponsorToken),
    });
    expect(sponsorOffersResponse.ok()).toBeTruthy();
    const sponsorOffers = await sponsorOffersResponse.json() as Array<Record<string, unknown>>;
    expect(sponsorOffers.find((offer) => Number(offer.pingId) === firstPingId)?.status).toBe('Accepted');
    expect(sponsorOffers.find((offer) => Number(offer.pingId) === secondPingId)?.status).toBe('Declined');

    const impactResponse = await request.get(apiUrl('/api/sponsor/impact'), {
      headers: authHeaders(sponsorToken),
    });
    expect(impactResponse.ok()).toBeTruthy();
    const impact = await parseJson(impactResponse);
    expect(impact.totalOffers).toBe(2);
    expect(impact.pendingOffers).toBe(0);
    expect(impact.acceptedOffers).toBe(1);
    expect(impact.declinedOffers).toBe(1);
    expect(impact.supportedPeople).toBe(1);

    const sponsorNotifications = await getNotifications(request, sponsorToken);
    const sponsorMessages = sponsorNotifications.map((notification) => String(notification.messageText));
    expect(sponsorMessages.some((message) => message.includes('chấp nhận'))).toBeTruthy();
    expect(sponsorMessages.some((message) => message.includes('từ chối'))).toBeTruthy();
  });

  test('force logout invalidates an existing token', async ({ request }) => {
    const adminToken = await login(request, adminEmail, adminPassword);
    const user = await registerUser(request, 'forcedlogout', 'Force Logout User');
    const userToken = await login(request, user.email, user.password);

    const beforeLogout = await getMe(request, userToken);
    expect(beforeLogout.ok()).toBeTruthy();

    const forceLogoutResponse = await request.post(apiUrl(`/api/admin/users/${user.userId}/force-logout`), {
      headers: authHeaders(adminToken),
    });
    expect(forceLogoutResponse.ok()).toBeTruthy();

    const staleTokenResponse = await getMe(request, userToken);
    expect(staleTokenResponse.status()).toBe(401);
  });

  test('role change invalidates an old token until the user logs in again', async ({ request }) => {
    const adminToken = await login(request, adminEmail, adminPassword);
    const user = await registerUser(request, 'roledrift', 'Role Drift User');
    const guestToken = await login(request, user.email, user.password);

    const beforeRoleChange = await getMe(request, guestToken);
    expect(beforeRoleChange.ok()).toBeTruthy();

    await approveRole(request, adminToken, user.userId, 'Volunteer');

    const staleTokenResponse = await getMe(request, guestToken);
    expect(staleTokenResponse.status()).toBe(401);

    const freshVolunteerToken = await login(request, user.email, user.password);
    const volunteerTasks = await request.get(apiUrl('/api/volunteer/tasks'), {
      headers: authHeaders(freshVolunteerToken),
    });
    expect(volunteerTasks.ok()).toBeTruthy();
  });

  test('ban invalidates an existing token immediately', async ({ request }) => {
    const adminToken = await login(request, adminEmail, adminPassword);
    const user = await registerUser(request, 'banneduser', 'Banned User');
    const userToken = await login(request, user.email, user.password);

    const beforeBan = await getMe(request, userToken);
    expect(beforeBan.ok()).toBeTruthy();

    const banResponse = await request.post(apiUrl(`/api/admin/users/${user.userId}/ban`), {
      headers: authHeaders(adminToken),
      data: { reason: 'Security regression test' },
    });
    expect(banResponse.ok()).toBeTruthy();

    const staleTokenResponse = await getMe(request, userToken);
    expect(staleTokenResponse.status()).toBe(401);
  });
});