'use client';

import { useEffect, useState } from 'react';
import { adminService } from '../../../services/admin.service';
import { Loader2, Download, Search, Filter } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function PaymentsManagement() {
    const [payments, setPayments] = useState<Record<string, unknown>[]>([]);
    const [stats, setStats] = useState({ count: 0, page: 1, limit: 20 });
    const [isLoading, setIsLoading] = useState(true);

    const fetchPayments = async () => {
        setIsLoading(true);
        try {
            const data = await adminService.getPayments(stats.page, stats.limit) as { payments: Record<string, unknown>[], count: number };
            setPayments(data.payments || []);
            setStats(prev => ({ ...prev, count: data.count || 0 }));
        } catch (error) {
            console.error(error);
            toast.error('Failed to load transaction history');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPayments();
    }, [stats.page]);

    const handleExport = async () => {
        try {
            const blob = await adminService.exportData('payments');
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `payments_export_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (error) {
            console.error(error);
            toast.error('Failed to export data');
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Transactions</h2>
                    <p className="text-slate-400">Revenue logs and payment statuses</p>
                </div>
                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                    <Download className="w-4 h-4" />
                    Export CSV
                </button>
            </header>

            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search by ID or email..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-primary/50 outline-none"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-500" />
                    <select className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-primary/50 outline-none">
                        <option value="all">All Status</option>
                        <option value="captured">Captured</option>
                        <option value="pending">Pending</option>
                        <option value="failed">Failed</option>
                    </select>
                </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-950/50 border-b border-slate-800">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">ID</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">User</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Gateway ID</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 opacity-20" />
                                        Loading payments...
                                    </td>
                                </tr>
                            ) : payments.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 italic">No payments found</td>
                                </tr>
                            ) : (
                                payments.map((pay: Record<string, unknown>, i) => (
                                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4 text-xs font-mono text-slate-500">
                                            {(pay.id as string).substring(0, 8)}...
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-white">{(pay.users as Record<string, unknown>)?.full_name as string || 'System User'}</div>
                                            <div className="text-xs text-slate-500 font-mono">{(pay.users as Record<string, unknown>)?.email as string}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-bold text-white">₹{(pay.amount as number).toFixed(2)}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${pay.status === 'paid' || pay.status === 'captured' || pay.status === 'success'
                                                ? 'bg-green-500/10 text-green-400'
                                                : pay.status === 'failed'
                                                    ? 'bg-red-500/10 text-red-400'
                                                    : 'bg-yellow-500/10 text-yellow-400'
                                                }`}>
                                                {pay.status as string}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                            {new Date(pay.created_at as string).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-600 text-right">
                                            {(pay.razorpay_payment_id as string) || '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center text-sm text-slate-400 pt-4">
                <div>Showing {payments.length} of {stats.count} transactions</div>
                <div className="flex gap-2">
                    <button
                        disabled={stats.page === 1}
                        onClick={() => setStats(s => ({ ...s, page: s.page - 1 }))}
                        className="px-4 py-2 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
                    >
                        Previous
                    </button>
                    <button
                        disabled={stats.page * stats.limit >= stats.count}
                        onClick={() => setStats(s => ({ ...s, page: s.page + 1 }))}
                        className="px-4 py-2 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
                    >
                        Next
                    </button>
                </div>
            </div>

        </div>
    );
}
