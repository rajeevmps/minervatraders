'use client';

import { useEffect, useState } from 'react';
import { adminService } from '../../../services/admin.service';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

export default function AuditLogs() {
    const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
    const [page] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const data = (await adminService.getAuditLogs(page, 50)) as { logs: Record<string, unknown>[] };
            setLogs(data.logs || []);
        } catch (err: unknown) {
            const error = err as { message?: string };
            toast.error(error.message || 'Failed to fetch audit logs');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [page]);

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-2xl font-bold text-white">System Audit Logs</h2>
                <p className="text-slate-400">View detailed history of system events. It&apos;s a log of all administrative actions taken.</p>
            </header>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden text-left">
                <table className="w-full">
                    <thead className="bg-slate-950/50 border-b border-slate-800">
                        <tr>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Action</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">User</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">IP Address</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Timestamp</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {isLoading ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 opacity-20" />
                                    Loading logs...
                                </td>
                            </tr>
                        ) : logs.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic">No logs found</td>
                            </tr>
                        ) : logs.map((log: Record<string, unknown>, i) => (
                            <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4 text-white font-medium">{log.action as string}</td>
                                <td className="px-6 py-4 text-slate-400 text-sm">
                                    {(log.users as Record<string, unknown>)?.full_name as string || (log.users as Record<string, unknown>)?.email as string || 'Unknown'}
                                    <div className="text-xs text-slate-600">{log.user_id as string}</div>
                                </td>
                                <td className="px-6 py-4 text-slate-400 text-sm font-mono">{log.ip_address as string || '-'}</td>
                                <td className="px-6 py-4 text-slate-400 text-sm">
                                    {new Date(log.created_at as string).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
