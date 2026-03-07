import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5164/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Don't redirect — map-first architecture uses modals for auth
    }
    return Promise.reject(error);
  }
);

// ═══════════════════════════════════════════
//  AUTH API
// ═══════════════════════════════════════════
export const authApi = {
  register: (data: { username: string; email: string; password: string; fullName: string }) =>
    api.post('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),

  googleLogin: (data: { credential: string }) =>
    api.post('/auth/google', data),

  verifyEmail: (data: { code: string }) =>
    api.post('/auth/verify-email', data),

  resendCode: () =>
    api.post('/auth/resend-code'),

  getMe: () =>
    api.get('/auth/me'),

  updateProfile: (data: { fullName?: string; avatarUrl?: string }) =>
    api.put('/auth/profile', data),

  submitVerification: (data: { requestedRole: string; reason?: string }) =>
    api.post('/auth/verify-role', data),
};

// ═══════════════════════════════════════════
//  MAP API
// ═══════════════════════════════════════════
export const mapApi = {
  getPings: (params?: { lat?: number; lng?: number; radius?: number }) =>
    api.get('/map/pings', { params }),

  getPingById: (id: number) =>
    api.get(`/map/pings/${id}`),

  createPing: (data: { lat: number; lng: number; type: string; details?: string }) =>
    api.post('/map/pings', data),

  updatePingStatus: (id: number, data: { status: string }) =>
    api.put(`/map/pings/${id}/status`, data),

  confirmSafe: (id: number) =>
    api.post(`/map/pings/${id}/confirm-safe`),

  // Routes: handled client-side via OSRM (OpenStreetMap), no backend proxy needed

  getZones: () =>
    api.get('/zone'),

  createZone: (data: { name: string; boundaryGeoJson: string; riskLevel: number }) =>
    api.post('/zone', data),

  getPingsByUser: (userId: string) =>
    api.get(`/map/pings/user/${userId}`),

  deletePing: (id: number) =>
    api.delete(`/map/pings/${id}`),
};

// ═══════════════════════════════════════════
//  SUPPLY API
// ═══════════════════════════════════════════
export const supplyApi = {
  getSupplies: () =>
    api.get('/supply'),

  getSupplyById: (id: number) =>
    api.get(`/supply/${id}`),

  createSupply: (data: { name: string; quantity: number; lat: number; lng: number }) =>
    api.post('/supply', data),

  updateSupply: (id: number, data: { name?: string; quantity?: number }) =>
    api.put(`/supply/${id}`, data),

  deleteSupply: (id: number) =>
    api.delete(`/supply/${id}`),
};

// ═══════════════════════════════════════════
//  SOCIAL API
// ═══════════════════════════════════════════
export const socialApi = {
  getPosts: (params?: { cursor?: string; limit?: number }) =>
    api.get('/social/posts', { params }),

  getPost: (id: number) =>
    api.get(`/social/posts/${id}`),

  createPost: (data: { content: string; category: string; imageUrl?: string }) =>
    api.post('/social/posts', data),

  addReaction: (postId: number, data: { type: string }) =>
    api.post(`/social/posts/${postId}/reactions`, data),

  getComments: (postId: number, params?: { cursor?: string; limit?: number }) =>
    api.get(`/social/posts/${postId}/comments`, { params }),

  addComment: (postId: number, data: { content: string }) =>
    api.post(`/social/posts/${postId}/comments`, data),

  getUserWall: (userId: string, params?: { cursor?: string; limit?: number }) =>
    api.get(`/social/users/${userId}/wall`, { params }),

  deletePost: (id: number) =>
    api.delete(`/social/posts/${id}`),
};

// ═══════════════════════════════════════════
//  CHATBOT API
// ═══════════════════════════════════════════
export const chatbotApi = {
  createConversation: () =>
    api.post('/chatbot/conversations'),

  sendMessage: (conversationId: number, data: { content: string }) =>
    api.post(`/chatbot/conversations/${conversationId}/messages`, data),

  getMessages: (conversationId: number) =>
    api.get(`/chatbot/conversations/${conversationId}/messages`),
};

// ═══════════════════════════════════════════
//  ADMIN API
// ═══════════════════════════════════════════
export const adminApi = {
  getUsers: (params?: { search?: string; role?: string; verificationStatus?: string; page?: number; pageSize?: number }) =>
    api.get('/admin/users', { params }),

  approveRole: (userId: string, data: { role: string }) =>
    api.put(`/admin/users/${userId}/role`, data),

  getVerifications: () =>
    api.get('/admin/verifications'),

  rejectVerification: (userId: string) =>
    api.post(`/admin/verifications/${userId}/reject`),

  deletePost: (postId: number) =>
    api.delete(`/admin/posts/${postId}`),

  getLogs: (params?: { from?: string; to?: string; action?: string; page?: number; pageSize?: number }) =>
    api.get('/admin/logs', { params }),

  getStats: () =>
    api.get('/admin/stats'),
};

export default api;
