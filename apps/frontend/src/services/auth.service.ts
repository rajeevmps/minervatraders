import api from './api';

export interface User {
    id: string;
    email: string;
    fullName?: string;
    avatarUrl?: string;
    role?: string;
    created_at?: string;
}

export interface LoginCredentials {
    email?: string;
    password?: string;
    provider?: string;
    idToken?: string;
}

export interface RegisterCredentials {
    email: string;
    password?: string;
    fullName?: string;
}

export const authService = {
    login: async (credentials: any) => {
        const response = await api.post('/auth/login', credentials);
        return response.data;
    },
    register: async (data: any) => {
        const response = await api.post('/auth/register', data);
        return response.data;
    },
    logout: async () => {
        // Since we are using Supabase directly in the frontend for auth mostly,
        // we should probably clear the session here.
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
        await supabase.auth.signOut();
    }
};
