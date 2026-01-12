import api from './api';
import { User, ApiResponse } from '@repo/types';
import { supabase } from '../lib/supabase';

export const authService = {
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
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
            // Map Supabase user to our User type
            return {
                id: session.user.id,
                email: session.user.email!,
                role: 'user', // Default or fetch from public.users table
                provider: session.user.app_metadata.provider as "email" | "google" | "github",
                createdAt: session.user.created_at
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
    }
};
