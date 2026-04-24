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

async function createPost(request: APIRequestContext, token: string, content: string) {
  const response = await request.post(apiUrl('/api/social/posts'), {
    headers: authHeaders(token),
    data: { content, category: 'Medical', imageUrl: null },
  });

  expect(response.status()).toBe(201);
  return parseJson(response);
}

test.describe('Post API', () => {
  let adminToken: string;
  let author: RegisteredUser;
  let reporter: RegisteredUser;

  test.beforeAll(async ({ request }) => {
    adminToken = await login(request, adminEmail, adminPassword);
    author = await registerUser(request, 'postauthor', 'Post Author');
    reporter = await registerUser(request, 'postreporter', 'Post Reporter');
  });

  test('reaction changes persist when switching reaction type', async ({ request }) => {
    const createdPost = await createPost(request, author.token, 'Post that will receive reactions');
    const postId = Number(createdPost.id);

    const likeResponse = await request.post(apiUrl(`/api/social/posts/${postId}/reactions`), {
      headers: authHeaders(reporter.token),
      data: { type: 'Like' },
    });
    expect(likeResponse.ok()).toBeTruthy();

    const loveResponse = await request.post(apiUrl(`/api/social/posts/${postId}/reactions`), {
      headers: authHeaders(reporter.token),
      data: { type: 'Love' },
    });
    expect(loveResponse.ok()).toBeTruthy();

    const detailResponse = await request.get(apiUrl(`/api/social/posts/${postId}`), {
      headers: authHeaders(reporter.token),
    });
    expect(detailResponse.ok()).toBeTruthy();

    const detail = await parseJson(detailResponse);
    expect(detail.likeCount).toBe(0);
    expect(detail.loveCount).toBe(1);
    expect(detail.prayCount).toBe(0);
    expect(detail.userReaction).toBe('Love');
  });

  test('post reports can be submitted and reviewed', async ({ request }) => {
    const createdPost = await createPost(request, author.token, 'Post that should be reportable');
    const postId = Number(createdPost.id);

    const reportResponse = await request.post(apiUrl(`/api/social/posts/${postId}/reports`), {
      headers: authHeaders(reporter.token),
      data: { reason: 'Contains misleading relief information.' },
    });
    expect(reportResponse.ok()).toBeTruthy();

    const duplicateResponse = await request.post(apiUrl(`/api/social/posts/${postId}/reports`), {
      headers: authHeaders(reporter.token),
      data: { reason: 'Duplicate pending report should be blocked.' },
    });
    expect(duplicateResponse.status()).toBe(409);

    const pendingResponse = await request.get(apiUrl('/api/admin/moderation/reports'), {
      headers: authHeaders(adminToken),
    });
    expect(pendingResponse.ok()).toBeTruthy();

    const pendingPayload = await parseJson(pendingResponse) as {
      items?: Array<Record<string, unknown>>;
    };
    const pendingReport = pendingPayload.items?.find((item) => Number(item.postId) === postId);
    expect(pendingReport).toBeTruthy();

    const reviewResponse = await request.post(apiUrl(`/api/admin/moderation/reports/${pendingReport?.id}/review`), {
      headers: authHeaders(adminToken),
    });
    expect(reviewResponse.ok()).toBeTruthy();

    const reviewedResponse = await request.get(apiUrl('/api/admin/moderation/reports?status=Reviewed'), {
      headers: authHeaders(adminToken),
    });
    expect(reviewedResponse.ok()).toBeTruthy();

    const reviewedPayload = await parseJson(reviewedResponse) as {
      items?: Array<Record<string, unknown>>;
    };
    expect(reviewedPayload.items?.some((item) => Number(item.id) === Number(pendingReport?.id))).toBeTruthy();
  });
});
