/**
 * Shared type definitions.
 *
 * Kept in step with the backend's API response shapes. The Google/GitHub OAuth
 * fields are gone: authentication is now email+password or Telegram Login, and
 * `providerId` no longer exists in the database.
 */

/** Authentication methods available on an account. */
export type AuthProvider = 'password' | 'telegram';

export type UserRole = 'user' | 'admin';

/**
 * Core User entity. Mirrors the API projection of the `users` table —
 * `password_hash` is never included in any response.
 */
export interface User {
    id: string;
    email: string;
    fullName?: string | null;
    avatarUrl?: string | null;
    role: UserRole;
    /** Telegram numeric id, serialised as a string because it exceeds 2^53. */
    telegramUserId?: string | null;
    telegramUsername?: string | null;
    emailVerified?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

/** Email + password sign-in. */
export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterCredentials {
    email: string;
    password: string;
    fullName?: string;
}

/**
 * Raw Telegram Login Widget payload. Forwarded to the API verbatim — the
 * server recomputes the HMAC over every field, so nothing may be dropped.
 */
export interface TelegramLoginPayload {
    id: number | string;
    auth_date: number | string;
    hash: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    [key: string]: unknown;
}

/**
 * Standardised API response envelope, matching utils/responseHelper.
 * @template T The type of the data payload.
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    message?: string;
    data?: T;
    error?: {
        code: string;
        details?: unknown;
    };
    timestamp: string;
}

/**
 * Payload returned by every endpoint that establishes a session.
 *
 * Only the short-lived access token appears here. The refresh token travels in
 * an httpOnly cookie and is deliberately unreadable from JavaScript.
 */
export interface AuthResponse {
    user: User;
    accessToken: string;
}

/** Paginated collection wrapper used by the admin endpoints. */
export interface Paginated<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export type SubscriptionStatus =
    | 'pending'
    | 'active'
    | 'expired'
    | 'cancelled'
    | 'refunded'
    | 'failed';

export interface SubscriptionPlan {
    id: string;
    name: string;
    description?: string | null;
    /** Whole rupees; the gateway conversion to paise happens server-side. */
    price: number;
    salePrice?: number | null;
    currency: string;
    durationDays: number;
    isActive?: boolean;
}

export interface Subscription {
    id: string;
    userId: string;
    planId: string;
    status: SubscriptionStatus;
    startDate: string;
    endDate: string;
    plan?: SubscriptionPlan;
}
