'use client';

import { useEffect, useState } from 'react';
import { adminService } from '../../../services/admin.service';
import { Loader2, AlertCircle, Search, CreditCard, Plus, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SubscriptionsManagement() {
    const [subscriptions, setSubscriptions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    const fetchSubscriptions = async () => {
        setIsLoading(true);
        try {
            // Need to implement this in adminService
            const data = await adminService.getSubscriptions();
            setSubscriptions(data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load subscriptions');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSubscriptions();
    }, []);

    const handleGrant = async () => {
        // Simple prompt for now, or modal later
        const email = prompt("Enter User Email to grant subscription:");
        const planId = prompt("Enter Plan ID (basic/pro/premium):", "premium");

        if (!email || !planId) return;

        try {
            await adminService.grantSubscription({ email, planId, durationInDays: 30 });
            toast.success('Subscription granted successfully');
            fetchSubscriptions();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to grant subscription');
        }
    };

    const handleRevoke = async (id: string, userId: string) => {
        if (!confirm('Immediately revoke this subscription?')) return;
        setLoadingAction(id);
        try {
            await adminService.revokeSubscription(userId);
            toast.success('Subscription revoked');
            fetchSubscriptions();
        } catch (error) {
            toast.error('Failed to revoke');
        } finally {
            setLoadingAction(null);
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Subscription Control</h2>
                    <p className="text-slate-400 text-sm">Manage active subscriber access</p>
                </div>
                <button
                    onClick={handleGrant}
                    className="flex items-center px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors text-sm font-medium"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Grant Subscription
                </button>
            </header>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900 border-b border-slate-800">
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase">User</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Plan</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Status</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Dates</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Loading subscriptions...
                                    </td>
                                </tr>
                            ) : subscriptions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500">
                                        No active subscriptions found.
                                    </td>
                                </tr>
                            ) : (
                                subscriptions.map(sub => (
                                    <tr key={sub.id} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center text-xs font-bold text-white mr-3">
                                                    {(sub.users?.full_name?.[0] || sub.users?.email?.[0] || '?').toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-white">{sub.users?.full_name || sub.users?.email?.split('@')[0]}</div>
                                                    <div className="text-xs text-slate-500">{sub.users?.email || 'Unknown User'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium text-slate-200">
                                                {sub.subscription_plans?.name || 'Custom Plan'}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {sub.subscription_plans?.price ? `₹${sub.subscription_plans.price.toLocaleString()}` : 'Free/Custom'}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`text-xs px-2 py-1 rounded-full flex items-center w-fit border ${sub.status === 'active'
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                                {sub.status === 'active' ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                                                <span className="uppercase tracking-wider text-[10px] font-bold">{sub.status}</span>
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-slate-500">
                                            <div className="flex flex-col space-y-1">
                                                <div className="flex justify-between w-32 text-xs">
                                                    <span className="text-slate-600">Start:</span>
                                                    <span className="text-slate-300 ml-2">{new Date(sub.start_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                </div>
                                                <div className="flex justify-between w-32 text-xs">
                                                    <span className="text-slate-600">End:</span>
                                                    <span className="text-slate-300 ml-2">{new Date(sub.end_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            {sub.status === 'active' && (
                                                <button
                                                    onClick={() => handleRevoke(sub.id, sub.user_id)}
                                                    disabled={loadingAction === sub.id}
                                                    className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-all disabled:opacity-50 group"
                                                    title="Revoke Access"
                                                >
                                                    {loadingAction === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
