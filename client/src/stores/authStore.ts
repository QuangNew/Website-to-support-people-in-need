import { create } from 'zustand';
import { authApi, setApiAuthToken, getApiAuthToken } from '../services/api';
import { useMessageStore } from './messageStore';

// ── SignalR Access Token (in-memory only, NOT persisted for security) ──
// Cross-origin WebSocket connections cannot reliably send HttpOnly cookies.
// The official Microsoft solution is to pass the JWT via query string using
// accessTokenFactory. We reuse the same in-memory token from the API module.

/** Retrieve the current JWT for SignalR accessTokenFactory. */
export function getSignalRToken(): string {
  return getApiAuthToken() ?? '';
}

export interface User {
    id: string;
    userName: string;
    email: string;
    fullName: string;
    phoneNumber?: string;
    address?: string;
    facebookUrl?: string;
    telegramUrl?: string;
    role: string;
    verificationStatus: string;
    emailVerified: boolean;
    avatarUrl?: string;
    createdAt: string;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    authResolved: boolean;

    login: (email: string, password: string) => Promise<void>;
    register: (data: { username: string; email: string; password: string; fullName: string }) => Promise<void>;
    googleLogin: (credential: string) => Promise<void>;
    verifyEmail: (email: string, code: string) => Promise<void>;
    resendCode: (email: string) => Promise<void>;
    logout: (options?: { localOnly?: boolean }) => Promise<void>;
    loadUser: () => Promise<void>;
    setUser: (user: User) => void;
}

interface AuthResponse {
    token: string;
    userId: string;
    userName: string;
    email: string;
    fullName: string;
    phoneNumber?: string;
    address?: string;
    role: string;
    emailVerified: boolean;
}

let pendingLoadUserPromise: Promise<void> | null = null;

function clearPersistedAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('chatpanel_messages');
    localStorage.removeItem('chatpanel_conversation_id');
    localStorage.removeItem('chatbot_messages');
    sessionStorage.removeItem('rc_auth_token');
}

function applyAuthResponse(
    set: (partial: Partial<AuthState>) => void,
    data: AuthResponse,
    verificationStatus = ''
) {
    // Store the JWT token for both API requests (Authorization header) and
    // SignalR accessTokenFactory. This is critical for cross-origin auth where
    // third-party cookies are blocked by modern browsers.
    if (data.token) {
        setApiAuthToken(data.token);
    }

    set({
        isAuthenticated: true,
        authResolved: true,
        user: {
            id: data.userId,
            userName: data.userName,
            fullName: data.fullName,
            phoneNumber: data.phoneNumber,
            address: data.address,
            role: data.role,
            email: data.email,
            emailVerified: data.emailVerified,
            verificationStatus,
            createdAt: '',
        },
    });
}

function hydrateAuthenticatedUserInBackground(set: (partial: Partial<AuthState>) => void) {
    const token = getApiAuthToken();
    if (!token) return;

    window.setTimeout(async () => {
        if (getApiAuthToken() !== token) return;

        try {
            const res = await authApi.getMe();
            if (getApiAuthToken() === token) {
                set({ user: res.data, isAuthenticated: true, authResolved: true });
            }
        } catch {
            // Login already succeeded and the auth response contains the minimum
            // user state needed by the UI. A transient /auth/me failure must not
            // turn a successful login into a visible login failure.
        }
    }, 300);
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    authResolved: false,

    login: async (email, password) => {
        set({ isLoading: true });
        try {
            const res = await authApi.login({ email, password });
            applyAuthResponse(set, res.data);
            hydrateAuthenticatedUserInBackground(set);
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            const message = axiosErr?.response?.data?.message;
            throw new Error(message || 'Đăng nhập thất bại');
        } finally {
            set({ isLoading: false });
        }
    },

    register: async (data) => {
        set({ isLoading: true });
        try {
            await authApi.register(data);
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string; errors?: string[] } } };
            const message = axiosErr?.response?.data?.message;
            const errors = axiosErr?.response?.data?.errors;
            throw new Error(errors?.join('. ') || message || 'Đăng ký thất bại');
        } finally {
            set({ isLoading: false });
        }
    },

    googleLogin: async (credential) => {
        set({ isLoading: true });
        try {
            const res = await authApi.googleLogin({ credential });
            applyAuthResponse(set, res.data);
            hydrateAuthenticatedUserInBackground(set);
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            const message = axiosErr?.response?.data?.message;
            throw new Error(message || 'Đăng nhập Google thất bại');
        } finally {
            set({ isLoading: false });
        }
    },

    verifyEmail: async (email, code) => {
        set({ isLoading: true });
        try {
            await authApi.verifyEmail({ email, code });
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            const message = axiosErr?.response?.data?.message;
            throw new Error(message || 'Xác nhận email thất bại');
        } finally {
            set({ isLoading: false });
        }
    },

    resendCode: async (email) => {
        try {
            await authApi.resendCode({ email });
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            const message = axiosErr?.response?.data?.message;
            throw new Error(message || 'Gửi lại mã thất bại');
        }
    },

    logout: async (options) => {
        if (!options?.localOnly) {
            try {
                await authApi.logout();
            } catch {
                // Clear local state even if the server-side logout request fails.
            }
        }

        setApiAuthToken(null);
        clearPersistedAuth();
        useMessageStore.getState().reset();
        set({ user: null, isAuthenticated: false, authResolved: true });
    },

    loadUser: async () => {
        if (pendingLoadUserPromise) {
            return pendingLoadUserPromise;
        }

        pendingLoadUserPromise = (async () => {
            try {
                const res = await authApi.getMe();
                set({ user: res.data, isAuthenticated: true, authResolved: true });
            } catch (err: unknown) {
                const axiosErr = err as { response?: { status?: number } };
                if (axiosErr?.response?.status === 401) {
                    // On production, cross-origin cookie may not be persisted yet.
                    // Retry once after a short delay before giving up.
                    await new Promise(r => setTimeout(r, 500));
                    try {
                        const retryRes = await authApi.getMe();
                        set({ user: retryRes.data, isAuthenticated: true, authResolved: true });
                        return;
                    } catch {
                        // Retry also failed — genuinely unauthenticated
                    }
                    clearPersistedAuth();
                    set({ user: null, isAuthenticated: false, authResolved: true });
                    return;
                }

                set({ authResolved: true });
            } finally {
                pendingLoadUserPromise = null;
            }
        })();

        return pendingLoadUserPromise;
    },

    setUser: (user) => set({ user, isAuthenticated: true, authResolved: true }),
}));
