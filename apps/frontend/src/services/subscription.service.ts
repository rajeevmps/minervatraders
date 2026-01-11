import api from './api';

export const subscriptionService = {
    getSubscriptions: async () => {
        const response = await api.get('/subscriptions');
        return response.data;
    },
    subscribe: async (planId: string) => {
        const response = await api.post('/subscriptions', { planId });
        return response.data;
    },
};
