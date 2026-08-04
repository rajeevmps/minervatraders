import { create } from 'zustand';
import type { LoginCredentials, RegisterCredentials, TelegramLoginPayload, User } from '@repo/types';
import { authService } from '../services/auth.service';
import { bootstrapSession } from '../services/api';
import { clearAccessToken } from '../lib/session';

/**
 * Auth state.
 *
 * Deliberately NOT persisted. The previous store wrapped everything in
 * `persist` and kept the access token in localStorage, which meant:
 *   - the token was readable by any script on the page, and
 *   - it was never refreshed, so it silently went stale after 15 minutes while
 *     the UI still believed the user was signed in.
 *
 * The session is now rebuilt on load from the httpOnly refresh cookie, which is
 * the single source of truth about whether the user is signed in.
 */

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    /** True until the initial refresh attempt settles — guards render flicker. */
    isLoading: boolean;

    login: (credentials: LoginCredentials) => Promise<User>;
    register: (credentials: RegisterCredentials) => Promise<User>;
    loginWithTelegram: (payload: TelegramLoginPayload) => Promise<User>;
    logout: () => Promise<void>;
    initialise: () => Promise<void>;
    setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,

    login: async (credentials) => {
        const user = await authService.login(credentials);
        set({ user, isAuthenticated: true, isLoading: false });
        return user;
    },

    register: async (credentials) => {
        const user = await authService.register(credentials);
        set({ user, isAuthenticated: true, isLoading: false });
        return user;
    },

    loginWithTelegram: async (payload) => {
        const user = await authService.loginWithTelegram(payload);
        set({ user, isAuthenticated: true, isLoading: false });
        return user;
    },

    logout: async () => {
        // Awaited, unlike the previous implementation, which fired the request
        // and cleared state immediately — leaving the refresh token alive.
        await authService.logout();
        set({ user: null, isAuthenticated: false, isLoading: false });
    },

    /** Restore the session on first load. Safe to call more than once. */
    initialise: async () => {
        try {
            const restored = await bootstrapSession();
            if (!restored) {
                set({ user: null, isAuthenticated: false, isLoading: false });
                return;
            }
            const user = await authService.getProfile();
            set({ user, isAuthenticated: true, isLoading: false });
        } catch {
            clearAccessToken();
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    },

    setUser: (user) => set({ user, isAuthenticated: Boolean(user), isLoading: false }),
}));

/** Convenience selector: is the signed-in user an administrator? */
export const useIsAdmin = () => useAuthStore((state) => state.user?.role === 'admin');
