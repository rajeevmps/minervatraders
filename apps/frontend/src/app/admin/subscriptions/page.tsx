'use client';

import { useEffect, useState } from 'react';
import { adminService } from '../../../services/admin.service';
import { Loader2, Plus, XCircle, Filter, Download } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Modal } from '../../../components/ui/Modal';

export default function SubscriptionsManagement() {
    const [subscriptions, setSubscriptions] = useState<Record<string, unknown>[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    const fetchSubscriptions = async () => {
        setIsLoading(true);
        try {
            const data = await adminService.getSubscriptions() as Record<string, unknown>[];
            setSubscriptions(data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load subscriptions');
        } finally {
            setIsLoading(false);
        }
    };

    // Modal State
    const [isGrantOpen, setIsGrantOpen] = useState(false);
    const [grantData, setGrantData] = useState({ email: '', planId: '', duration: 30 });
    const [availablePlans, setAvailablePlans] = useState<Record<string, unknown>[]>([]);

    useEffect(() => {
        fetchSubscriptions();
        adminService.getPlans().then((data) => setAvailablePlans(data as Record<string, unknown>[])).catch(console.error);
    }, []);

    const handleGrant = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoadingAction('grant');
        try {
            await adminService.grantSubscription({
                email: grantData.email,
                planId: grantData.planId || (availablePlans[0]?.id as string),
                durationInDays: grantData.duration
            });
            toast.success('Subscription granted successfully');
            setIsGrantOpen(false);
            setGrantData({ email: '', planId: '', duration: 30 });
            fetchSubscriptions();
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            toast.error(error.response?.data?.message || 'Failed to grant subscription');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleRevoke = async (subscriptionId: string) => {
        if (!confirm('Are you sure you want to revoke this subscription?')) return;

        setLoadingAction(subscriptionId);
        try {
            await adminService.revokeSubscription(subscriptionId);
            toast.success('Subscription revoked');
            fetchSubscriptions();
        } catch (err: unknown) {
            const error = err as { message?: string };
            toast.error(error.message || 'Failed to revoke subscription');
        } finally {
            setLoadingAction(null);
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Subscription Management</h2>
                    <p className="text-slate-400">View and manage all active user subscriptions.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => window.open(adminService.getExportUrl('subscriptions'), '_blank')}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                    <button
                        onClick={() => setIsGrantOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                    >
                        <Plus className="w-4 h-4" />
                        Grant Subscription
                    </button>
                </div>
            </header>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
                    <div className="text-slate-400 text-sm mb-1">Total Subscriptions</div>
                    <div className="text-2xl font-bold text-white">{subscriptions.length}</div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
                    <div className="text-slate-400 text-sm mb-1">Active Now</div>
                    <div className="text-2xl font-bold text-green-400">
                        {subscriptions.filter(s => new Date(s.expires_at as string) > new Date()).length}
                    </div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
                    <div className="text-slate-400 text-sm mb-1">Recent (24h)</div>
                    <div className="text-2xl font-bold text-primary">
                        {subscriptions.filter(s => new Date(s.created_at as string) > new Date(Date.now() - 86400000)).length}
                    </div>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px] relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search by email or user ID..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-primary/50 outline-none"
                    />
                </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-950/50 border-b border-slate-800">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">User</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Expires At</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 opacity-20" />
                                        Loading subscriptions...
                                    </td>
                                </tr>
                            ) : subscriptions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">No subscriptions found</td>
                                </tr>
                            ) : (
                                subscriptions.map((sub, i) => {
                                    const isExpired = new Date(sub.expires_at as string) < new Date();
                                    const user = Array.isArray(sub.users) ? sub.users[0] : sub.users as Record<string, unknown>;
                                    return (
                                        <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-white">{user?.full_name as string || 'System User'}</div>
                                                <div className="text-xs text-slate-500 font-mono">{user?.email as string || (sub.user_id as string)?.substring(0, 8) || '-'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary uppercase">
                                                    {sub.plan_name as string || (sub.plan_info as Record<string, unknown>)?.name as string || 'Custom'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isExpired ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'
                                                    }`}>
                                                    {isExpired ? 'Expired' : 'Active'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                                {new Date(sub.expires_at as string).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => handleRevoke(sub.id as string)}
                                                    disabled={loadingAction === sub.id}
                                                    className="text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors flex items-center gap-1.5 ml-auto"
                                                >
                                                    {loadingAction === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                                    Revoke
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Grant Modal */}
            <Modal
                isOpen={isGrantOpen}
                onClose={() => setIsGrantOpen(false)}
                title="Grant Subscription"
            >
                <form onSubmit={handleGrant} className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase block mb-1.5">User Email</label>
                        <input
                            required
                            type="email"
                            placeholder="user@example.com"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary/50 outline-none"
                            value={grantData.email}
                            onChange={e => setGrantData({ ...grantData, email: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase block mb-1.5">Plan</label>
                            <select
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary/50 outline-none"
                                value={grantData.planId}
                                onChange={e => {
                                    const selectedPlan = availablePlans.find(p => (p as Record<string, unknown>).id === e.target.value) as Record<string, unknown> | undefined;
                                    setGrantData({
                                        ...grantData,
                                        planId: e.target.value,
                                        duration: selectedPlan ? (selectedPlan.duration_days as number) : 30
                                    });
                                }}
                            >
                                <option value="" disabled>Select a plan</option>
                                {availablePlans.map((plan: Record<string, unknown>) => (
                                    <option key={plan.id as string} value={plan.id as string}>
                                        {plan.name as string} ({plan.duration_days as number} days) - ₹{plan.price as number}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase block mb-1.5">Days</label>
                            <input
                                required
                                type="number"
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary/50 outline-none"
                                value={grantData.duration}
                                onChange={e => setGrantData({ ...grantData, duration: parseInt(e.target.value) })}
                            />
                        </div>
                    </div>
                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={() => setIsGrantOpen(false)}
                            className="flex-1 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loadingAction === 'grant'}
                            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            {loadingAction === 'grant' ? 'Granting...' : 'Grant Subscription'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
