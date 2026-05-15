import axios from 'axios';
import toast from 'react-hot-toast';
import { uploadToStorage } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

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
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export interface HideCommentRequest {
  durationDays?: number | null;
  reason: string;
  notifyUser: boolean;
}

export const AUTH_EXPIRED_EVENT = 'reliefconnect:auth-expired';

function isPublicAuthRequest(url: string): boolean {
  return /\/auth\/(login|register|google|forgot-password|reset-password)$/.test(url);
}

function isAuthHydrationRequest(url: string): boolean {
  return /\/auth\/me$/.test(url);
}

function notifyAuthExpired() {
  _inMemoryToken = null;
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem('token');
  localStorage.removeItem('user');

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
}

// ── In-memory JWT token for Authorization header ──
// Cross-origin cookies (SameSite=None) are increasingly blocked by browsers
// (Safari ITP, Chrome third-party cookie deprecation). We use the Authorization
// header as primary auth mechanism. The token is persisted in sessionStorage
// (cleared on tab close) so it survives page refreshes but not new sessions.
const TOKEN_STORAGE_KEY = 'rc_auth_token';
let _inMemoryToken: string | null = sessionStorage.getItem(TOKEN_STORAGE_KEY);

/** Set the JWT token for API requests. Called by auth store after login. */
export function setApiAuthToken(token: string | null) {
  _inMemoryToken = token;
  if (token) {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

/** Get the current JWT token. Used by SignalR and other services. */
export function getApiAuthToken(): string | null {
  return _inMemoryToken;
}

// Request interceptor: attach Authorization header for cross-origin auth.
api.interceptors.request.use(
  (config) => {
    if (_inMemoryToken) {
      config.headers.Authorization = `Bearer ${_inMemoryToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle 401 and 429
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = String(error.config?.url ?? '');
    if (
      error.response?.status === 401
      && !isPublicAuthRequest(requestUrl)
      && !isAuthHydrationRequest(requestUrl)
    ) {
      notifyAuthExpired();
    }
    // Global spam/rate-limit handler
    if (error.response?.status === 429) {
      const data = error.response.data as { message?: string; suspended?: boolean };
      toast.error(data?.message || 'Bạn đang thao tác quá nhanh. Vui lòng thử lại sau.', { duration: 6000 });
      if (data?.suspended) {
        setTimeout(() => window.location.reload(), 3000);
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

  logout: () =>
    api.post('/auth/logout'),

  getMe: () =>
    api.get('/auth/me'),

  getBasicProfile: (userId: string) =>
    api.get(`/auth/users/${userId}/basic-profile`),

  updateProfile: (data: { fullName?: string; avatarUrl?: string; phoneNumber?: string; facebookUrl?: string; telegramUrl?: string }) =>
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
  getPings: (params?: { lat?: number; lng?: number; radius?: number; radiusKm?: number }) => {
    if (!params) {
      return api.get('/map/pings');
    }

    const { radius, radiusKm, ...rest } = params;
    return api.get('/map/pings', {
      params: {
        ...rest,
        ...(radiusKm ?? radius) !== undefined ? { radiusKm: radiusKm ?? radius } : {},
      },
    });
  },

  getPingById: (id: number) =>
    api.get(`/map/pings/${id}`),

  createPing: (data: {
    lat: number;
    lng: number;
    type: string;
    contactName?: string;
    contactPhone?: string;
    details?: string;
    conditionImageUrl?: string;
    sosCategory?: string;
  }) =>
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

  reportPost: (postId: number, data: { reason: string }) =>
    api.post(`/social/posts/${postId}/reports`, data),

  addReaction: (postId: number, data: { type: string }) =>
    api.post(`/social/posts/${postId}/reactions`, data),

  getComments: (postId: number, params?: { cursor?: string; limit?: number }) =>
    api.get(`/social/posts/${postId}/comments`, { params }),

  addComment: (postId: number, data: { content: string; parentCommentId?: number }) =>
    api.post(`/social/posts/${postId}/comments`, data),

  getUserWall: (userId: string, params?: { cursor?: string; limit?: number }) =>
    api.get(`/social/users/${userId}/wall`, { params }),

  deletePost: (id: number, data: { reason: string }) =>
    api.delete(`/social/posts/${id}`, { data }),

  hideComment: (postId: number, commentId: number, data: HideCommentRequest) =>
    api.post(`/admin/moderation/posts/${postId}/comments/${commentId}/hide`, data),
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

  getPendingPosts: (params?: { page?: number; pageSize?: number; category?: string }) =>
    api.get('/admin/moderation/posts/pending', { params }),

  approvePost: (postId: number) =>
    api.post(`/admin/moderation/posts/${postId}/approve`),

  rejectPost: (postId: number, data: { reason: string }) =>
    api.post(`/admin/moderation/posts/${postId}/reject`, data),

  pinPost: (postId: number) =>
    api.post(`/admin/moderation/posts/${postId}/pin`),

  deletePost: (postId: number, data: { reason: string }) =>
    api.delete(`/admin/moderation/posts/${postId}`, { data }),

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

  getLogs: (params?: { from?: string; to?: string; action?: string; adminsOnly?: boolean; userId?: string; page?: number; pageSize?: number }) =>
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

  getApiKeyCatalog: () =>
    api.get('/admin/api-keys/catalog'),

  createApiKey: (data: { provider: string; label: string; keyValue: string; model: string }) =>
    api.post('/admin/api-keys', data),

  updateApiKey: (id: number, data: { provider?: string; label?: string; keyValue?: string; model?: string; isActive?: boolean }) =>
    api.put(`/admin/api-keys/${id}`, data),

  testApiKey: (id: number) =>
    api.post(`/admin/api-keys/${id}/test`),

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
//  VOLUNTEER API
// ═══════════════════════════════════════════
export const volunteerApi = {
  getAvailableTasks: (params?: { lat?: number; lng?: number }) =>
    api.get('/volunteer/tasks', { params }),

  acceptTask: (data: { pingId: number }) =>
    api.post('/volunteer/accept-task', data),

  getActiveTasks: () =>
    api.get('/volunteer/active-tasks'),

  completeTask: (pingId: number, data: { completionNotes?: string }) =>
    api.post(`/volunteer/tasks/${pingId}/complete`, data),

  getTaskHistory: () =>
    api.get('/volunteer/tasks/history'),

  getStats: () =>
    api.get('/volunteer/stats'),
};

// ═══════════════════════════════════════════
//  PERSON IN NEED API
// ═══════════════════════════════════════════
export const personInNeedApi = {
  getOffers: () =>
    api.get('/person-in-need/offers'),

  respondToOffer: (offerId: number, data: { decision: 'Accepted' | 'Declined' }) =>
    api.post(`/person-in-need/offers/${offerId}/respond`, data),
};

// ═══════════════════════════════════════════
//  SPONSOR API
// ═══════════════════════════════════════════
export const sponsorApi = {
  searchCases: (params?: { category?: string; status?: string; lat?: number; lng?: number; radiusKm?: number }) =>
    api.get('/sponsor/cases', { params }),

  offerHelp: (data: { pingId: number; message?: string }) =>
    api.post('/sponsor/offer-help', data),

  getOffers: () =>
    api.get('/sponsor/offers'),

  getImpact: () =>
    api.get('/sponsor/impact'),
};

// ═══════════════════════════════════════════
//  ANNOUNCEMENT API (public, authenticated)
// ═══════════════════════════════════════════
export const announcementApi = {
  getActive: (limit?: number) =>
    api.get('/announcements/active', { params: { limit } }),
};

// ═══════════════════════════════════════════
//  MESSAGE API
// ═══════════════════════════════════════════
export interface SendDirectMessagePayload {
  content: string;
  clientMessageId?: string;
}

export const messageApi = {
  getConversations: () =>
    api.get('/messages/conversations'),

  getMessages: (conversationId: number, params?: { before?: number; after?: number; limit?: number }) =>
    api.get(`/messages/conversations/${conversationId}/messages`, { params }),

  startConversation: (targetUserId: string) =>
    api.post('/messages/conversations', { targetUserId }),

  sendMessage: (conversationId: number, payload: SendDirectMessagePayload) =>
    api.post(`/messages/conversations/${conversationId}/messages`, payload),

  markRead: (conversationId: number) =>
    api.put(`/messages/conversations/${conversationId}/read`),

  getUnreadCount: () =>
    api.get('/messages/unread-count'),

  searchUsers: (q: string) =>
    api.get('/messages/search-users', { params: { q } }),
};

export default api;
