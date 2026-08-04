import { useState, useEffect, useCallback } from 'react';
import type { ApiResponse } from '@repo/types';
import api from '../services/api';
import { useAuthStore } from '../store/auth.store';

interface InviteResponse {
    inviteLink: string;
    expiresAt?: string;
}

/**
 * Fetches the Telegram channel invite for an active subscriber.
 *
 * The API returns an existing, still-valid invite when there is one, so calling
 * this repeatedly does not litter the channel with unused invite links.
 */
export function useTelegramLink(subscriptionStatus: string | undefined) {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    const [telegramLink, setTelegramLink] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchLink = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.get<ApiResponse<InviteResponse>>('/telegram/invite');
            setTelegramLink(response.data.data?.inviteLink ?? null);
        } catch {
            setError('Could not generate your invite link. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (subscriptionStatus !== 'active' || !isAuthenticated) return;
        void fetchLink();
    }, [subscriptionStatus, isAuthenticated, fetchLink]);

    return { telegramLink, isLoading, error, refetch: fetchLink };
}
