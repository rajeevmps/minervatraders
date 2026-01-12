/**
 * Core User entity shared across the application.
 * Corresponds to the 'users' table in the database.
 */
export interface User {
    id: string;
    email: string;
    fullName?: string;
    avatarUrl?: string;
    role: 'user' | 'admin'; // Enforce specific roles
    provider?: 'email' | 'google' | 'github';
    providerId?: string;
    createdAt?: string;
    updatedAt?: string;
}

/**
 * Credentials required for authentication.
 * Supports both traditional email/password and OAuth flows.
 */
export interface LoginCredentials {
    email?: string;
    password?: string;
    provider?: 'email' | 'google' | 'github';
    idToken?: string; // For OAuth flows
}

/**
 * Standardized API Response structure.
 * Ensures consistent response format between Backend and Frontend.
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
 * Common Auth Response containing user and token.
 */
export interface AuthResponse {
    user: User;
    token: string;
}
