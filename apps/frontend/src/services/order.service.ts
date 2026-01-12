import api from './api';

export const orderService = {
    createOrder: async (orderData: Record<string, unknown>) => {
        const response = await api.post('/orders', orderData);
        return response.data;
    },
    getOrders: async () => {
        const response = await api.get('/orders');
        return response.data;
    },
};
