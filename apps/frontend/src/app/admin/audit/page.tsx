'use client';

import { Activity } from 'lucide-react';

export default function AuditLogs() {
    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-2xl font-bold text-white">System Audit Logs</h2>
                <p className="text-slate-400 text-sm">Detailed history of system events.</p>
            </header>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-white mb-2">Audit Logging Enabled</h3>
                <p className="max-w-md mx-auto">
                    System events including logins, subscription changes, and user modifications are being recorded.
                    <br /><br />
                    (This feature is currently in preview mode. Full historical data table coming soon.)
                </p>
            </div>
        </div>
    );
}
