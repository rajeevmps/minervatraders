import api from './api';

export const cartService = {
    getCart: async () => {
        const response = await api.get('/cart');
        return response.data;
    },
    addToCart: async (item: any) => {
        const response = await api.post('/cart', item);
        return response.data;
    },
    removeFromCart: async (itemId: string) => {
        const response = await api.delete(`/cart/${itemId}`);
        return response.data;
    },
};
