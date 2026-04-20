import { expect, test, type APIRequestContext } from '@playwright/test';

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:5164';

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

async function createConversation(request: APIRequestContext, token: string): Promise<number> {
  const response = await request.post(apiUrl('/api/chatbot/conversations'), {
    headers: authHeaders(token),
  });

  expect(response.ok()).toBeTruthy();
  const payload = await parseJson(response);
  return Number(payload.id);
}

test.describe('Chatbot API', () => {
  let token: string;
  let conversationId: number;

  test.beforeAll(async ({ request }) => {
    const user = await registerUser(request, 'chatbotuser', 'Chatbot Test User');
    token = user.token;
    conversationId = await createConversation(request, token);
  });

  test('send message requires image base64 and mime type to be paired', async ({ request }) => {
    const response = await request.post(apiUrl(`/api/chatbot/conversations/${conversationId}/messages`), {
      headers: authHeaders(token),
      data: {
        content: 'Analyze this image',
        imageMimeType: 'image/png',
      },
    });

    expect(response.status()).toBe(400);
    const payload = await parseJson(response);
    expect(String(payload.message)).toContain('both be provided');
  });

  test('send message rejects invalid base64 image data', async ({ request }) => {
    const response = await request.post(apiUrl(`/api/chatbot/conversations/${conversationId}/messages`), {
      headers: authHeaders(token),
      data: {
        content: 'Analyze this image',
        imageBase64: 'not-valid-base64',
        imageMimeType: 'image/png',
      },
    });

    expect(response.status()).toBe(400);
    const payload = await parseJson(response);
    expect(String(payload.message)).toContain('Invalid base64 image data');
  });

  test('send message rejects oversized images before calling the provider', async ({ request }) => {
    const oversizedImageBase64 = Buffer.alloc((4 * 1024 * 1024) + 1, 7).toString('base64');

    const response = await request.post(apiUrl(`/api/chatbot/conversations/${conversationId}/messages`), {
      headers: authHeaders(token),
      data: {
        content: 'Analyze this oversized image',
        imageBase64: oversizedImageBase64,
        imageMimeType: 'image/png',
      },
    });

    expect(response.status()).toBe(400);
    const payload = await parseJson(response);
    expect(String(payload.message)).toContain('Image exceeds 4 MB limit');
  });

  test('send message returns 404 for a stale conversation id', async ({ request }) => {
    const response = await request.post(apiUrl('/api/chatbot/conversations/999999999/messages'), {
      headers: authHeaders(token),
      data: { content: 'This conversation should not exist.' },
    });

    expect(response.status()).toBe(404);
    const payload = await parseJson(response);
    expect(String(payload.message)).toContain('Conversation not found');
  });
});