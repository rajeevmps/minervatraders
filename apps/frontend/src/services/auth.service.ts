import api from './api';
import { User, ApiResponse, LoginCredentials } from '@repo/types';
import { supabase } from '../lib/supabase';

export const authService = {
    /**
     * Login user with email and password.
     */
    login: async (credentials: LoginCredentials): Promise<{ user: User; token: string }> => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: credentials.email!,
            password: credentials.password!,
        });

        if (error) throw error;

        // Fetch custom user profile if needed, or map session user
        const user: User = {
            id: data.user.id,
            email: data.user.email!,
            role: 'user', // Default, should be enhanced with actual role fetch if ready
            createdAt: data.user.created_at,
        };

        return { user, token: data.session.access_token };
    },

    /**
     * Register new user.
     */
    register: async (credentials: LoginCredentials): Promise<{ user: User; token: string }> => {
        const { data, error } = await supabase.auth.signUp({
            email: credentials.email!,
            password: credentials.password!,
        });

        if (error) throw error;

        // For sign-up, session might be null depending on email confirmation settings
        if (!data.session)
            throw new Error('Registration successful. Please check your email to confirm.');

        const user: User = {
            id: data.user!.id,
            email: data.user!.email!,
            role: 'user',
            createdAt: data.user!.created_at,
        };

        return { user, token: data.session.access_token };
    },

    /**
     * Logout user.
     * Clears Supabase session.
     */
    logout: async (): Promise<void> => {
        await supabase.auth.signOut();
    },

    /**
     * Get current session info (if needed for initial load).
     */
    getSession: async (): Promise<User | null> => {
        const {
            data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
            // Map Supabase user to our User type
            return {
                id: session.user.id,
                email: session.user.email!,
                role: 'user', // Default or fetch from public.users table
                provider: session.user.app_metadata.provider as 'email' | 'google' | 'github',
                createdAt: session.user.created_at,
            };
        }
        return null;
    },

    getProfile: async (): Promise<User> => {
        const response = await api.get<ApiResponse<User>>('/auth/me');
        return response.data.data;
    },

    /**
     * Sync user profile with backend.
     */
    syncUser: async (user: Record<string, unknown>): Promise<void> => {
        await api.post('/auth/sync', user);
    },
};
