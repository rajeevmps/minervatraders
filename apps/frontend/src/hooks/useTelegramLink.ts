import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

export function useTelegramLink(subscriptionStatus: string | undefined) {
    const { token } = useAuthStore();
    const [telegramLink, setTelegramLink] = useState<string | null>(null);

    useEffect(() => {
        if (subscriptionStatus === 'active' && token) {
            const fetchLink = async () => {
                try {
                    const response = await axios.get(
                        `${process.env.NEXT_PUBLIC_API_URL}/telegram/invite`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );

                    if (response.data && response.data.inviteLink) {
                        setTelegramLink(response.data.inviteLink);
                    }
                } catch (error) {
                    console.error('Telegram Invite Error:', error);
                }
            };

            fetchLink();
        }
    }, [subscriptionStatus, token]);

    return { telegramLink };
}
