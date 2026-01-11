import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, LoginCredentials, RegisterCredentials } from '../services/auth.service';
import { authService } from '../services/auth.service';

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    login: (credentials: LoginCredentials) => Promise<void>;
    register: (credentials: RegisterCredentials) => Promise<void>;
    logout: () => void;
    setAuth: (user: User, token: string) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            login: async (credentials) => {
                const { user, token } = await authService.login(credentials);
                set({ user, token, isAuthenticated: true });
            },
            register: async (credentials) => {
                const { user, token } = await authService.register(credentials);
                set({ user, token, isAuthenticated: true });
            },
            logout: () => {
                authService.logout();
                set({ user: null, token: null, isAuthenticated: false });
            },
            setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
        }),
        {
            name: 'auth-storage',
        }
    )
);
