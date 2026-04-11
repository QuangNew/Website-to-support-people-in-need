import axios from 'axios';
import { uploadToStorage } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5164/api';

/** Base server URL (without /api) for resolving uploaded file paths like /uploads/... */
const SERVER_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

/** Resolve an image path to a full URL. Handles absolute URLs, relative /uploads/... paths, and data URIs. */
export function getImageUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('data:') || path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${SERVER_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
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
      // Only clear token if there is no token at all (truly unauthenticated).
      // If a token exists but got 401, it means the role/claim check failed —
      // keep the token so other non-protected requests still work.
      const token = localStorage.getItem('token');
      if (!token) {
        localStorage.removeItem('user');
      }
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

  uploadAvatar: async (file: File): Promise<string | null> => {
    return uploadToStorage('avatars', file);
  },

  submitVerification: (data: { requestedRole: string; reason?: string; imageUrls?: string[]; phoneNumber: string; address?: string }) =>
    api.post('/auth/verify-role', data),

  getContactInfo: (userId: string) =>
    api.get(`/auth/users/${userId}/contact`),

  forgotPassword: (data: { email: string }) =>
    api.post('/auth/forgot-password', data),

  resetPassword: (data: { email: string; token: string; newPassword: string }) =>
    api.post('/auth/reset-password', data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/auth/change-password', data),
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

  getZone: (id: number) =>
    api.get(`/zone/${id}`),

  createZone: (data: { name: string; boundaryGeoJson: string; riskLevel: number }) =>
    api.post('/zone', data),

  updateZone: (id: number, data: { name: string; boundaryGeoJson: string; riskLevel: number }) =>
    api.put(`/zone/${id}`, data),

  deleteZone: (id: number) =>
    api.delete(`/zone/${id}`),

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

  uploadImage: async (file: File) => {
    // Try Supabase Storage first, fall back to backend
    const publicUrl = await uploadToStorage('post-images', file);
    if (publicUrl) return { data: { imageUrl: publicUrl } };

    const formData = new FormData();
    formData.append('file', file);
    return api.post('/social/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

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

  hideComment: (postId: number, commentId: number) =>
    api.delete(`/admin/moderation/posts/${postId}/comments/${commentId}`),
};

// ═══════════════════════════════════════════
//  CHATBOT API
// ═══════════════════════════════════════════
export const chatbotApi = {
  createConversation: () =>
    api.post('/chatbot/conversations'),

  sendMessage: (conversationId: number, data: { content: string; imageBase64?: string; imageMimeType?: string }) =>
    api.post(`/chatbot/conversations/${conversationId}/messages`, data, { timeout: 60000, maxBodyLength: 6_000_000 }),

  getMessages: (conversationId: number) =>
    api.get(`/chatbot/conversations/${conversationId}/messages`),
};

// ═══════════════════════════════════════════
//  ADMIN API (3-controller split)
// ═══════════════════════════════════════════
export const adminApi = {
  // ── User Management (AdminController: /api/admin) ──
  getUsers: (params?: { search?: string; role?: string; verificationStatus?: string; page?: number; pageSize?: number }) =>
    api.get('/admin/users', { params }),

  getUserDetail: (userId: string) =>
    api.get(`/admin/users/${userId}`),

  approveRole: (userId: string, data: { role: string }) =>
    api.put(`/admin/users/${userId}/role`, data),

  getVerifications: () =>
    api.get('/admin/verifications'),

  rejectVerification: (userId: string) =>
    api.post(`/admin/verifications/${userId}/reject`),

  suspendUser: (userId: string, data: { reason: string; until?: string }) =>
    api.post(`/admin/users/${userId}/suspend`, data),

  unsuspendUser: (userId: string) =>
    api.post(`/admin/users/${userId}/unsuspend`),

  banUser: (userId: string, data: { reason: string }) =>
    api.post(`/admin/users/${userId}/ban`, data),

  forceLogout: (userId: string) =>
    api.post(`/admin/users/${userId}/force-logout`),

  resetVerification: (userId: string) =>
    api.post(`/admin/users/${userId}/reset-verification`),

  batchActions: (data: {
    roleApprovals: { userId: string; role: string }[];
    roleRejections: string[];
    postDeletions: number[];
  }) => api.post('/admin/batch', data),

  // ── Content Moderation (AdminModerationController: /api/admin/moderation) ──
  getPosts: (params?: { page?: number; pageSize?: number; category?: string }) =>
    api.get('/admin/moderation/posts', { params }),

  pinPost: (postId: number) =>
    api.post(`/admin/moderation/posts/${postId}/pin`),

  deletePost: (postId: number) =>
    api.delete(`/admin/moderation/posts/${postId}`),

  deleteComment: (postId: number, commentId: number) =>
    api.delete(`/admin/moderation/posts/${postId}/comments/${commentId}`),

  restorePost: (postId: number) =>
    api.post(`/admin/moderation/posts/${postId}/restore`),

  getDeletedPosts: (params?: { page?: number; pageSize?: number }) =>
    api.get('/admin/moderation/posts/deleted', { params }),

  restoreComment: (postId: number, commentId: number) =>
    api.post(`/admin/moderation/posts/${postId}/comments/${commentId}/restore`),

  getHiddenComments: (params?: { page?: number; pageSize?: number }) =>
    api.get('/admin/moderation/comments/hidden', { params }),

  getReports: (params?: { status?: string; page?: number; pageSize?: number }) =>
    api.get('/admin/moderation/reports', { params }),

  reviewReport: (reportId: number) =>
    api.post(`/admin/moderation/reports/${reportId}/review`),

  dismissReport: (reportId: number) =>
    api.post(`/admin/moderation/reports/${reportId}/dismiss`),

  // ── System Operations (AdminSystemController: /api/admin/system) ──
  getStats: () =>
    api.get('/admin/system/stats'),

  getLogs: (params?: { from?: string; to?: string; action?: string; page?: number; pageSize?: number }) =>
    api.get('/admin/system/logs', { params }),

  getLogChildren: (logId: number) =>
    api.get(`/admin/system/logs/${logId}/children`),

  getAnnouncements: (params?: { page?: number; pageSize?: number }) =>
    api.get('/admin/system/announcements', { params }),

  createAnnouncement: (data: { title: string; content: string; expiresAt?: string }) =>
    api.post('/admin/system/announcements', data),

  updateAnnouncement: (id: number, data: { title?: string; content?: string; expiresAt?: string }) =>
    api.put(`/admin/system/announcements/${id}`, data),

  deleteAnnouncement: (id: number) =>
    api.delete(`/admin/system/announcements/${id}`),

  exportUsersCsv: () =>
    api.get('/admin/system/export/users', { responseType: 'blob' }),

  exportLogsCsv: () =>
    api.get('/admin/system/export/logs', { responseType: 'blob' }),

  forceResolveSOS: (pingId: number) =>
    api.post(`/admin/system/sos/${pingId}/force-resolve`),

  // ── API Key Pool (ApiKeyController: /api/admin/api-keys) ──
  getApiKeys: () =>
    api.get('/admin/api-keys'),

  createApiKey: (data: { provider: string; label: string; keyValue: string; model: string }) =>
    api.post('/admin/api-keys', data),

  updateApiKey: (id: number, data: { label?: string; keyValue?: string; model?: string; isActive?: boolean }) =>
    api.put(`/admin/api-keys/${id}`, data),

  deleteApiKey: (id: number) =>
    api.delete(`/admin/api-keys/${id}`),
};

// ═══════════════════════════════════════════
//  NOTIFICATION API
// ═══════════════════════════════════════════
export const notificationApi = {
  getNotifications: (params?: { page?: number; pageSize?: number; unreadOnly?: boolean }) =>
    api.get('/notifications', { params }),

  getUnreadCount: () =>
    api.get('/notifications/unread-count'),

  markRead: (id: number) =>
    api.put(`/notifications/${id}/read`),

  markAllRead: () =>
    api.put('/notifications/read-all'),

  deleteNotification: (id: number) =>
    api.delete(`/notifications/${id}`),
};

// ═══════════════════════════════════════════
//  ANNOUNCEMENT API (public, authenticated)
// ═══════════════════════════════════════════
export const announcementApi = {
  getActive: (limit?: number) =>
    api.get('/announcements/active', { params: { limit } }),
};

export default api;
