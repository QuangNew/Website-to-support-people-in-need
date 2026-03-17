import { APIRequestContext } from '@playwright/test';

export class ApiHelper {
  constructor(private request: APIRequestContext) {}

  async register(email: string, password: string, role: string) {
    return this.request.post('/api/auth/register', {
      data: { email, password, confirmPassword: password, role },
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
