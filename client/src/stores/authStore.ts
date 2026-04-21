import { create } from 'zustand';
import { authApi } from '../services/api';
import { useMessageStore } from './messageStore';

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
    verifyEmail: (code: string) => Promise<void>;
    resendCode: () => Promise<void>;
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
}

function applyAuthResponse(
    set: (partial: Partial<AuthState>) => void,
    data: AuthResponse,
    verificationStatus = ''
) {
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

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    authResolved: false,

    login: async (email, password) => {
        set({ isLoading: true });
        try {
            const res = await authApi.login({ email, password });
            applyAuthResponse(set, res.data);
            await get().loadUser();
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
            const res = await authApi.register(data);
            applyAuthResponse(set, res.data, 'None');
            await get().loadUser();
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
            await get().loadUser();
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            const message = axiosErr?.response?.data?.message;
            throw new Error(message || 'Đăng nhập Google thất bại');
        } finally {
            set({ isLoading: false });
        }
    },

    verifyEmail: async (code) => {
        set({ isLoading: true });
        try {
            await authApi.verifyEmail({ code });
            const user = get().user;
            if (user) set({ user: { ...user, emailVerified: true } });
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            const message = axiosErr?.response?.data?.message;
            throw new Error(message || 'Xác nhận email thất bại');
        } finally {
            set({ isLoading: false });
        }
    },

    resendCode: async () => {
        try {
            await authApi.resendCode();
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
