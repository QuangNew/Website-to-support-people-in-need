import { create } from 'zustand';
import { authApi } from '../services/api';

export interface User {
    id: string;
    userName: string;
    email: string;
    fullName: string;
    phoneNumber?: string;
    address?: string;
    role: string;
    verificationStatus: string;
    emailVerified: boolean;
    avatarUrl?: string;
    createdAt: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;

    login: (email: string, password: string) => Promise<void>;
    register: (data: { username: string; email: string; password: string; fullName: string }) => Promise<void>;
    googleLogin: (credential: string) => Promise<void>;
    verifyEmail: (code: string) => Promise<void>;
    resendCode: () => Promise<void>;
    logout: () => void;
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

function applyAuthResponse(
    set: (partial: Partial<AuthState>) => void,
    data: AuthResponse,
    verificationStatus = ''
) {
    localStorage.setItem('token', data.token);
    set({
        token: data.token,
        isAuthenticated: true,
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
    token: localStorage.getItem('token'),
    isAuthenticated: false,
    isLoading: false,

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

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('chatpanel_messages');
        localStorage.removeItem('chatpanel_conversation_id');
        localStorage.removeItem('chatbot_messages');
        set({ user: null, token: null, isAuthenticated: false });
    },

    loadUser: async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const res = await authApi.getMe();
            set({ user: res.data, isAuthenticated: true, token });
        } catch (err: unknown) {
            // Only logout on a confirmed 401 (expired/invalid token).
            // Network errors, timeouts, 500s → keep the token, stay logged in.
            const axiosErr = err as { response?: { status?: number } };
            if (axiosErr?.response?.status === 401) {
                get().logout();
            }
        }
    },

    setUser: (user) => set({ user }),
}));
