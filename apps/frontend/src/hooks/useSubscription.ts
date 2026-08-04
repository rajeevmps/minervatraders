import { useState, useEffect } from 'react';
import type { ApiResponse, Subscription } from '@repo/types';
import api from '../services/api';
import { useAuthStore } from '../store/auth.store';

/**
 * The signed-in user's active subscription, or null.
 *
 * Uses the shared `api` client rather than a bare axios call with a token read
 * from the store. That token was persisted in localStorage and never refreshed,
 * so this hook silently started failing 15 minutes after sign-in.
 */
export function useSubscription() {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const isAuthLoading = useAuthStore((state) => state.isLoading);

    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Wait for session restoration before concluding the user is anonymous.
        if (isAuthLoading) return;

        if (!isAuthenticated) {
            setSubscription(null);
            setIsLoading(false);
            return;
        }

        let cancelled = false;

        (async () => {
            setIsLoading(true);
            try {
                const response = await api.get<ApiResponse<Subscription>>('/subscriptions');
                // `data` is absent rather than null when there is no subscription.
                if (!cancelled) setSubscription(response.data.data ?? null);
            } catch {
                if (!cancelled) setError('Could not load your subscription');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, isAuthLoading]);

    return { subscription, isLoading, error };
}
