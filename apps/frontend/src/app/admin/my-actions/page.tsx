'use client';

import { useEffect, useState } from 'react';
import { adminService } from '../../../services/admin.service';
import { authService } from '../../../services/auth.service';
import { Activity } from 'lucide-react';

export default function MyActions() {
    const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                // Get current user to filter logs
                const user = await authService.getProfile();

                if (user && user.id) {
                    const data = (await adminService.getAuditLogs(1, 50, user.id)) as { logs: Record<string, unknown>[] };
                    setLogs(data.logs || []);
                }
            } catch (error) {
                console.error("Failed to load my actions", error);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    return (
        <div className="space-y-6">
            <header className="flex items-center gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-white">My Recent Actions</h2>
                    <p className="text-slate-400">View your activity history. It&apos;s a log of all administrative actions you&apos;ve taken.</p>
                </div>
            </header>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-800/50 text-slate-400 text-sm font-medium">
                        <tr>
                            <th className="px-6 py-4">Action</th>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">IP Address</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {isLoading ? (
                            <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-500">Loading your history...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-500">You haven&apos;t performed any logged actions yet.</td></tr>
                        ) : logs.map((log: Record<string, unknown>) => (
                            <tr key={log.id as string} className="hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4 text-white font-medium">
                                    <div className="flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-purple-400" />
                                        {log.action as string}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-400 text-sm">
                                    {new Date(log.created_at as string).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-slate-500 text-xs font-mono">{log.ip_address as string || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
