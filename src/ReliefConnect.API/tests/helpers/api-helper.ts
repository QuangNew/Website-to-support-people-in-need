import { APIRequestContext } from '@playwright/test';

export class ApiHelper {
  constructor(private request: APIRequestContext) {}

  async register(email: string, password: string, fullName = 'Test User') {
    const localPart = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'tester';
    const username = `${localPart}${Date.now().toString().slice(-6)}`;

    return this.request.post('/api/auth/register', {
      data: { username, email, password, fullName },
    });
  }

  async login(email: string, password: string) {
    const response = await this.request.post('/api/auth/login', {
      data: { email, password },
    });
    const data = await response.json();
    return data.token;
  }

  async createAuthHeaders(token: string) {
    return { Authorization: `Bearer ${token}` };
  }
}
