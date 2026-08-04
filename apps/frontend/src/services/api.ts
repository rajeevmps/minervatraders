import axios, {
    AxiosError,
    AxiosRequestConfig,
    AxiosResponse,
    InternalAxiosRequestConfig,
} from 'axios';
import { getAccessToken, setAccessToken, clearAccessToken } from '../lib/session';

/**
 * HTTP client.
 *
 * Replaces the Supabase-backed interceptor. Two behaviours matter:
 *
 *  1. `withCredentials` — the refresh token is an httpOnly cookie, so it must
 *     be sent on cross-origin calls to /auth/refresh.
 *  2. On a 401, ONE refresh is attempted and the original request is replayed.
 *     Concurrent 401s share that single refresh rather than each firing their
 *     own, which would trip the server's token-reuse detection and log the user
 *     out — refresh tokens rotate, so parallel refreshes look like theft.
 */

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

/** Endpoints that must never trigger a refresh attempt of their own. */
const AUTH_ENDPOINTS = ['/auth/refresh', '/auth/login', '/auth/register', '/auth/telegram'];

type RetriableConfig = AxiosRequestConfig & { _retried?: boolean };

// Shared in-flight refresh, so N concurrent 401s cause exactly one rotation.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
    if (!refreshPromise) {
        refreshPromise = axios
            .post<{ data: { accessToken: string } }>(
                `${api.defaults.baseURL}/auth/refresh`,
                {},
                { withCredentials: true }
            )
            .then((response) => {
                const token = response.data?.data?.accessToken ?? null;
                setAccessToken(token);
                return token;
            })
            .catch(() => {
                clearAccessToken();
                return null;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }
    return refreshPromise;
}

api.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
        const original = error.config as RetriableConfig | undefined;

        const isUnauthorized = error.response?.status === 401;
        const isAuthCall = AUTH_ENDPOINTS.some((path) => original?.url?.includes(path));

        if (!isUnauthorized || !original || original._retried || isAuthCall) {
            return Promise.reject(error);
        }

        original._retried = true;

        const token = await refreshAccessToken();
        if (!token) {
            // The session is genuinely gone; let the caller surface it.
            return Promise.reject(error);
        }

        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        return api(original);
    }
);

/**
 * Exchange the refresh cookie for an access token on page load.
 * Returns false when there is no valid session.
 */
export async function bootstrapSession(): Promise<boolean> {
    return (await refreshAccessToken()) !== null;
}

/** Pull a human-readable message out of the API's error envelope. */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as
            | { message?: string; error?: { details?: Array<{ message: string }> } }
            | undefined;

        const validationDetail = data?.error?.details?.[0]?.message;
        if (validationDetail) return validationDetail;
        if (data?.message) return data.message;
        if (!error.response) return 'Cannot reach the server. Is it running?';
    }
    return fallback;
}

export default api;
