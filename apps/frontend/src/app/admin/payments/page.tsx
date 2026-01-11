'use client';

import { useEffect, useState } from 'react';
import { adminService } from '../../../services/admin.service';
import { Loader2, Download, ArrowUpRight, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function PaymentsManagement() {
    const [payments, setPayments] = useState<any[]>([]);
    const [stats, setStats] = useState({ count: 0, page: 1, limit: 20 });
    const [isLoading, setIsLoading] = useState(true);

    const fetchPayments = async () => {
        setIsLoading(true);
        try {
            const data = await adminService.getPayments(stats.page, stats.limit);
            setPayments(data.data);
            setStats(prev => ({ ...prev, count: data.count }));
        } catch (error) {
            toast.error('Failed to load transaction history');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchPayments(); }, [stats.page]);

    const handleExport = () => {
        const url = adminService.getExportUrl('payments');
        // Trigger download in new window/tab or same
        window.open(url, '_blank');
        toast.success('Export started');
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Transactions</h2>
                    <p className="text-slate-400 text-sm">Revenue logs and payment statuses</p>
                </div>
                <button
                    onClick={handleExport}
                    className="flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                </button>
            </header>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900 border-b border-slate-800">
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase">ID</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase">User</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Amount</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Status</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Date</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Gateway ID</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Loading transactions...
                                    </td>
                                </tr>
                            ) : payments.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500">
                                        No transactions found.
                                    </td>
                                </tr>
                            ) : (
                                payments.map(pay => (
                                    <tr key={pay.id} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="p-4 text-xs font-mono text-slate-500">
                                            {pay.id.slice(0, 8)}...
                                        </td>
                                        <td className="p-4">
                                            <div className="text-sm font-medium text-white">{pay.users?.full_name || 'N/A'}</div>
                                            <div className="text-xs text-slate-500">{pay.users?.email}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className="font-medium text-white">₹{pay.amount}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`text-xs px-2 py-1 rounded-full ${pay.status === 'captured' || pay.status === 'success'
                                                    ? 'bg-green-500/10 text-green-400'
                                                    : pay.status === 'failed'
                                                        ? 'bg-red-500/10 text-red-400'
                                                        : 'bg-yellow-500/10 text-yellow-400'
                                                }`}>
                                                {pay.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-slate-500">
                                            {new Date(pay.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="p-4 text-xs font-mono text-slate-600">
                                            {pay.razorpay_payment_id || '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Simple Pagination */}
                <div className="p-4 border-t border-slate-800 flex justify-between items-center text-sm text-slate-500">
                    <div>Showing {(stats.page - 1) * stats.limit + 1} to {Math.min(stats.page * stats.limit, stats.count)} of {stats.count}</div>
                    <div className="flex gap-2">
                        <button
                            disabled={stats.page === 1}
                            onClick={() => setStats(s => ({ ...s, page: s.page - 1 }))}
                            className="px-3 py-1 bg-slate-800 rounded hover:bg-slate-700 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <button
                            disabled={stats.page * stats.limit >= stats.count}
                            onClick={() => setStats(s => ({ ...s, page: s.page + 1 }))}
                            className="px-3 py-1 bg-slate-800 rounded hover:bg-slate-700 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
