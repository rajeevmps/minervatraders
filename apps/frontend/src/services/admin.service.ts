import api from './api';

export interface AdminTableData {
    tables: string[];
}

export interface TableRecord {
    [key: string]: any;
}

export interface TableResponse {
    data: TableRecord[];
    count: number;
    page: number;
    limit: number;
}

export const adminService = {
    // Stats
    getStats: async () => {
        const response = await api.get('/admin/stats');
        return response.data;
    },

    // User Management
    getUsers: async (page = 1, limit = 10, search = '') => {
        const response = await api.get(`/admin/users?page=${page}&limit=${limit}&search=${search}`);
        return response.data;
    },

    createUser: async (userData: any) => {
        const response = await api.post('/admin/users', userData);
        return response.data;
    },

    updateUser: async (id: string, updates: any) => {
        const response = await api.put(`/admin/users/${id}`, updates);
        return response.data;
    },

    deleteUser: async (id: string) => {
        const response = await api.delete(`/admin/users/${id}`);
        return response.data;
    },

    // Subscription Management
    getSubscriptions: async () => {
        const response = await api.get('/admin/subscriptions');
        return response.data; // Expecting array of subscriptions
    },

    grantSubscription: async (data: { email: string, planId: string, durationInDays: number }) => {
        const response = await api.post('/admin/subscriptions/grant', data);
        return response.data;
    },

    revokeSubscription: async (userId: string) => {
        const response = await api.post('/admin/subscriptions/revoke', { userId });
        return response.data;
    },



    // Plans Management
    getPlans: async () => {
        const response = await api.get('/admin/plans');
        return response.data;
    },

    createPlan: async (planData: any) => {
        const response = await api.post('/admin/plans', planData);
        return response.data;
    },

    updatePlan: async (id: string, updates: any) => {
        const response = await api.put(`/admin/plans/${id}`, updates);
        return response.data;
    },

    deletePlan: async (id: string) => {
        const response = await api.delete(`/admin/plans/${id}`);
        return response.data;
    },



    // Payments & Export
    getPayments: async (page = 1, limit = 20) => {
        const response = await api.get(`/admin/payments?page=${page}&limit=${limit}`);
        return response.data;
    },

    // Returns the URL for downloading since it's a file stream
    getExportUrl: (type: 'users' | 'subscriptions' | 'payments') => {
        return `${process.env.NEXT_PUBLIC_API_URL}/admin/export/${type}`;
    },

    // Legacy / Generic Tables
    getTables: async (): Promise<string[]> => {
        const response = await api.get('/admin/tables');
        return response.data.tables;
    },

    getTableData: async (tableName: string, page = 1, limit = 20): Promise<TableResponse> => {
        const response = await api.get(`/admin/tables/${tableName}?page=${page}&limit=${limit}`);
        return response.data;
    }
};
