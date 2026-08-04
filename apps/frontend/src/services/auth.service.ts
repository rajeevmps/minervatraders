import api from './api';
import type {
    ApiResponse,
    AuthResponse,
    LoginCredentials,
    RegisterCredentials,
    TelegramLoginPayload,
    User,
} from '@repo/types';
import { setAccessToken, clearAccessToken } from '../lib/session';

/**
 * Authentication against our own API. Replaces the Supabase client entirely.
 *
 * Every call that establishes a session stores the access token in memory; the
 * refresh token is set by the server as an httpOnly cookie and is never visible
 * to this code.
 */

const unwrap = <T>(response: { data: ApiResponse<T> }): T => response.data.data as T;

export const authService = {
    async login(credentials: LoginCredentials): Promise<User> {
        const session = unwrap(await api.post<ApiResponse<AuthResponse>>('/auth/login', credentials));
        setAccessToken(session.accessToken);
        return session.user;
    },

    async register(credentials: RegisterCredentials): Promise<User> {
        const session = unwrap(
            await api.post<ApiResponse<AuthResponse>>('/auth/register', credentials)
        );
        setAccessToken(session.accessToken);
        return session.user;
    },

    /** Sign in (or transparently sign up) with a Telegram Login Widget payload. */
    async loginWithTelegram(payload: TelegramLoginPayload): Promise<User> {
        const session = unwrap(
            await api.post<ApiResponse<AuthResponse>>('/auth/telegram', payload)
        );
        setAccessToken(session.accessToken);
        return session.user;
    },

    /** Attach a Telegram identity to the account already signed in. */
    async linkTelegram(payload: TelegramLoginPayload): Promise<User> {
        return unwrap(await api.post<ApiResponse<User>>('/auth/link-telegram', payload));
    },

    async logout(): Promise<void> {
        try {
            await api.post('/auth/logout');
        } finally {
            // Clear locally even if the network call fails, so the UI never
            // shows a signed-in state the user asked to leave.
            clearAccessToken();
        }
    },

    async getProfile(): Promise<User> {
        return unwrap(await api.get<ApiResponse<User>>('/auth/me'));
    },

    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
        await api.post('/auth/change-password', { currentPassword, newPassword });
        // The server revokes every session on password change.
        clearAccessToken();
    },
};
