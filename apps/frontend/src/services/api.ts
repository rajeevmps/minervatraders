import axios from 'axios';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
});

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

api.interceptors.request.use(async (config) => {
    // 1. Try to get fresh session from Supabase logic
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // Fallback removed: We only trust Supabase session.

    return config;
});

export default api;
