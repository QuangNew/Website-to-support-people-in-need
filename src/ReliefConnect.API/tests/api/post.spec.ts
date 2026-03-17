import { test, expect } from '@playwright/test';
import { ApiHelper } from '../helpers/api-helper';

test.describe('Post API', () => {
  let api: ApiHelper;
  let token: string;

  test.beforeAll(async ({ request }) => {
    api = new ApiHelper(request);
    const email = `posttest${Date.now()}@example.com`;
    await api.register(email, 'Password123', 'Volunteer');
    token = await api.login(email, 'Password123');
  });

  test('create post', async ({ request }) => {
    const response = await request.post('/api/post', {
      headers: await api.createAuthHeaders(token),
      data: { content: 'Test post content', imageUrl: null },
    });
    expect(response.ok()).toBeTruthy();
  });

  test('get all posts', async ({ request }) => {
    const response = await request.get('/api/post');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('like post', async ({ request }) => {
    const createRes = await request.post('/api/post', {
      headers: await api.createAuthHeaders(token),
      data: { content: 'Post to like', imageUrl: null },
    });
    const post = await createRes.json();

    const likeRes = await request.post(`/api/post/${post.id}/like`, {
      headers: await api.createAuthHeaders(token),
    });
    expect(likeRes.ok()).toBeTruthy();
  });
});
