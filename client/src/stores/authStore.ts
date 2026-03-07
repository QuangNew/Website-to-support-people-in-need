import { create } from 'zustand';
import { authApi } from '../services/api';

export interface User {
    id: string;
    userName: string;
    email: string;
    fullName: string;
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

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    token: localStorage.getItem('token'),
    isAuthenticated: false,
    isLoading: false,

    login: async (email, password) => {
        set({ isLoading: true });
        try {
            const res = await authApi.login({ email, password });
            const { token, userId, userName, fullName, role, emailVerified } = res.data;

            localStorage.setItem('token', token);

            set({
                token,
                isAuthenticated: true,
                user: { id: userId, userName, fullName, role, email, emailVerified, verificationStatus: '', createdAt: '' },
            });

            // Fetch full profile
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
            const { token, userId, userName, fullName, role, emailVerified } = res.data;

            localStorage.setItem('token', token);

            set({
                token,
                isAuthenticated: true,
                user: { id: userId, userName, fullName, role, email: data.email, emailVerified, verificationStatus: 'None', createdAt: '' },
            });

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
            const { token, userId, userName, fullName, role, emailVerified } = res.data;

            localStorage.setItem('token', token);

            set({
                token,
                isAuthenticated: true,
                user: { id: userId, userName, fullName, role, email: '', emailVerified, verificationStatus: '', createdAt: '' },
            });

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
        set({ user: null, token: null, isAuthenticated: false });
    },

    loadUser: async () => {
        const token = get().token;
        if (!token) return;

        try {
            const res = await authApi.getMe();
            set({ user: res.data, isAuthenticated: true });
        } catch {
            // Token invalid, clear everything
            get().logout();
        }
    },

    setUser: (user) => set({ user }),
}));
