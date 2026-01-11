'use client';

import { Settings as SettingsIcon, Save } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

export default function AdminSettings() {
    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-2xl font-bold text-white">System Settings</h2>
                <p className="text-slate-400 text-sm">Configure system-wide parameters and preferences.</p>
            </header>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-slate-800 rounded-lg">
                        <SettingsIcon className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-white">General Configuration</h3>
                        <p className="text-sm text-slate-500">Manage basic application settings</p>
                    </div>
                </div>

                <form className="space-y-6 max-w-2xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Site Name</label>
                            <input
                                type="text"
                                defaultValue="MinervaTraders"
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Support Email</label>
                            <input
                                type="email"
                                defaultValue="support@minervatraders.com"
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Telegram Channel ID</label>
                        <input
                            type="text"
                            defaultValue="-1002447939250"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
                        />
                        <p className="text-xs text-slate-500">The primary channel for automated user additions.</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="maintenance" className="rounded border-slate-800 bg-slate-950 text-primary focus:ring-primary" />
                        <label htmlFor="maintenance" className="text-sm font-medium text-slate-300">Enable Maintenance Mode</label>
                    </div>

                    <div className="pt-4">
                        <Button variant="primary">
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
