'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import type { ApiResponse } from '@repo/types';
import api, { apiErrorMessage } from '../../../services/api';

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState({
        TELEGRAM_BOT_TOKEN: '',
        TELEGRAM_CHANNEL_ID: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                // Goes through the shared client, which attaches a live token
                // and refreshes it on expiry. This previously used a bare axios
                // call with a stale token from localStorage.
                const { data } = await api.get<ApiResponse<Record<string, string>>>('/settings');
                setSettings((prev) => ({ ...prev, ...(data.data ?? {}) }));
            } catch (error) {
                toast.error(apiErrorMessage(error, 'Failed to load settings'));
            } finally {
                setLoading(false);
            }
        };

        void fetchSettings();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSettings((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            // The bot token comes back masked (••••1234). Submitting the mask
            // unchanged is understood server-side as "leave the secret alone".
            await api.post('/settings', settings);
            toast.success('Settings updated successfully');
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Failed to save settings'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-white">Loading settings...</div>;
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-white mb-8">System Settings</h1>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-xl p-6 shadow-xl"
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="border-b border-slate-700 pb-4 mb-4">
                        <h2 className="text-xl font-semibold text-blue-400 mb-1">Telegram Integration</h2>
                        <p className="text-sm text-slate-400">Configure your Telegram Bot credentials here. These are used to generate invite links.</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Telegram Bot Token
                            </label>
                            <input
                                type="password"
                                name="TELEGRAM_BOT_TOKEN"
                                value={settings.TELEGRAM_BOT_TOKEN}
                                onChange={handleChange}
                                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-slate-500 mt-1">Found in BotFather</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Telegram Channel ID
                            </label>
                            <input
                                type="text"
                                name="TELEGRAM_CHANNEL_ID"
                                value={settings.TELEGRAM_CHANNEL_ID}
                                onChange={handleChange}
                                placeholder="-100xxxxxxxxxx"
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-slate-500 mt-1">Usually starts with -100 for channels</p>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-700 flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className={`px-6 py-2 rounded-lg font-medium text-white transition-all
                                ${saving
                                    ? 'bg-blue-600/50 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20'}`}
                        >
                            {saving ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
