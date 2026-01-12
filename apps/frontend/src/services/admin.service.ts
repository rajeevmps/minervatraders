import api from './api';
import { ApiResponse } from '@repo/types';

export interface AdminTableData {
    tables: string[];
}

export interface TableRecord {
    [key: string]: unknown;
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
        return response.data.data;
    },

    // User Management
    getUsers: async (page = 1, limit = 10, search = '') => {
        const response = await api.get(`/admin/users?page=${page}&limit=${limit}&search=${search}`);
        return response.data.data;
    },

    createUser: async (userData: Record<string, unknown>) => {
        const response = await api.post('/admin/users', userData);
        return response.data.data;
    },

    updateUser: async (id: string, updates: Record<string, unknown>) => {
        const response = await api.put(`/admin/users/${id}`, updates);
        return response.data.data;
    },

    deleteUser: async (id: string) => {
        const response = await api.delete(`/admin/users/${id}`);
        return response.data.data;
    },

    exportData: async (type: string) => {
        const response = await api.get(`/admin/export/${type}`, { responseType: 'blob' });
        return response.data as Blob;
    },

    getAuditLogs: async (page = 1, limit = 20, userId?: string) => {
        let url = `/admin/audit?page=${page}&limit=${limit}`;
        if (userId) url += `&userId=${userId}`;
        const response = await api.get<ApiResponse<Record<string, unknown>>>(url);
        return response.data.data; // Now returns object with logs, count etc.
    },

    // Subscription Management
    getSubscriptions: async () => {
        const response = await api.get('/admin/subscriptions');
        return response.data.data; // Expecting array of subscriptions
    },

    grantSubscription: async (data: { email: string, planId: string, durationInDays: number }) => {
        const response = await api.post('/admin/subscriptions/grant', data);
        return response.data.data;
    },

    revokeSubscription: async (subscriptionId: string) => {
        const response = await api.post('/admin/subscriptions/revoke', { subscriptionId });
        return response.data.data;
    },



    // Plans Management
    getPlans: async () => {
        const response = await api.get('/admin/plans');
        return response.data.data;
    },

    createPlan: async (planData: Record<string, unknown>) => {
        const response = await api.post('/admin/plans', planData);
        return response.data.data;
    },

    updatePlan: async (id: string, updates: Record<string, unknown>) => {
        const response = await api.put(`/admin/plans/${id}`, updates);
        return response.data.data;
    },

    deletePlan: async (id: string) => {
        const response = await api.delete(`/admin/plans/${id}`);
        return response.data.data;
    },



    // Payments & Export
    getPayments: async (page = 1, limit = 20) => {
        const response = await api.get(`/admin/payments?page=${page}&limit=${limit}`);
        return response.data.data;
    },

    // Returns the URL for downloading since it's a file stream
    getExportUrl: (type: 'users' | 'subscriptions' | 'payments') => {
        return `${process.env.NEXT_PUBLIC_API_URL}/admin/export/${type}`;
    },

    // Webhook Inspector
    getWebhooks: async (page = 1, limit = 20) => {
        const response = await api.get(`/admin/webhooks?page=${page}&limit=${limit}`);
        return response.data.data;
    },

    // Legacy / Generic Tables
    getTables: async (): Promise<string[]> => {
        const response = await api.get('/admin/tables');
        return response.data.data.tables;
    },

    getTableData: async (tableName: string, page = 1, limit = 20): Promise<TableResponse> => {
        const response = await api.get(`/admin/tables/${tableName}?page=${page}&limit=${limit}`);
        return response.data.data;
    }
};
