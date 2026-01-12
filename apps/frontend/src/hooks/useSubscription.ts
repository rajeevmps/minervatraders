import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

interface Subscription {
    id: string;
    status: string;
    start_date: string;
    end_date: string;
    plan: {
        name: string;
    };
    telegram_invite_link?: string;
}

export function useSubscription() {
    const { token, isAuthenticated } = useAuthStore();
    const [isLoading, setIsLoading] = useState(true);
    const [subscription, setSubscription] = useState<Subscription | null>(null);

    useEffect(() => {
        if (!isAuthenticated || !token) {
            setIsLoading(false);
            return;
        }

        const fetchSubscription = async () => {
            try {
                const subResponse = await axios.get(
                    `${process.env.NEXT_PUBLIC_API_URL}/subscriptions`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                if (subResponse.data && !subResponse.data.message) {
                    setSubscription(subResponse.data);
                }
            } catch (error) {
                console.error('Subscription Fetch Error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSubscription();
    }, [isAuthenticated, token]);

    return { subscription, isLoading };
}
