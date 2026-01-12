'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminService } from '../../../services/admin.service';
import { ArrowRight, Table as TableIcon, Loader2, AlertCircle, Users, CreditCard, TrendingUp, Activity } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function AdminDashboard() {
    const [stats, setStats] = useState<Record<string, unknown> | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await adminService.getStats();
                setStats(data as Record<string, unknown>);
            } catch (err: unknown) {
                const e = err as { response?: { data?: { message?: string } }; message?: string };
                console.error('Failed to fetch stats:', e);
                setError(e.response?.data?.message || e.message || 'Unknown error');
                toast.error('Failed to load system metrics');
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Aggregating system metrics...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-red-400 bg-red-500/5 rounded-2xl border border-red-500/10 p-8">
                <AlertCircle className="w-10 h-10 mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-1">Dashboard Unreachable</h3>
                <p className="text-sm opacity-75">{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header>
                <h2 className="text-3xl font-bold text-white">System Overview</h2>
                <p className="text-slate-400 mt-2">Real-time performance indicators.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    label="Total Users"
                    value={(stats?.totalUsers as number) || 0}
                    icon={Users}
                    color="text-blue-400"
                    bg="bg-blue-400/10"
                />
                <StatCard
                    label="Active Subscriptions"
                    value={(stats?.activeSubscriptions as number) || 0}
                    icon={CreditCard}
                    color="text-green-400"
                    bg="bg-green-400/10"
                />
                <StatCard
                    label="Total Revenue"
                    value={`₹${(stats?.totalRevenue as number) || 0}`}
                    icon={TrendingUp}
                    color="text-amber-400"
                    bg="bg-amber-400/10"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8 border-t border-slate-800">
                {/* Quick Actions */}
                <div>
                    <h3 className="text-xl font-bold text-white mb-6">Quick Actions</h3>
                    <div className="grid grid-cols-1 gap-4">
                        <Link href="/admin/users" className="p-4 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors flex items-center group">
                            <div className="p-3 bg-blue-500/10 rounded-lg mr-4 group-hover:bg-blue-500/20 transition-colors">
                                <Users className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <div className="font-medium text-white">Manage Users</div>
                                <div className="text-sm text-slate-500">View, edit, or ban users</div>
                            </div>
                            <ArrowRight className="w-4 h-4 ml-auto text-slate-500 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <Link href="/admin/subscriptions" className="p-4 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors flex items-center group">
                            <div className="p-3 bg-green-500/10 rounded-lg mr-4 group-hover:bg-green-500/20 transition-colors">
                                <CreditCard className="w-5 h-5 text-green-400" />
                            </div>
                            <div>
                                <div className="font-medium text-white">Manage Subscriptions</div>
                                <div className="text-sm text-slate-500">Grant or revoke access</div>
                            </div>
                            <ArrowRight className="w-4 h-4 ml-auto text-slate-500 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <Link href="/admin/plans" className="p-4 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors flex items-center group">
                            <div className="p-3 bg-purple-500/10 rounded-lg mr-4 group-hover:bg-purple-500/20 transition-colors">
                                <TableIcon className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <div className="font-medium text-white">Update Plans</div>
                                <div className="text-sm text-slate-500">Modify pricing & features</div>
                            </div>
                            <ArrowRight className="w-4 h-4 ml-auto text-slate-500 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>
                </div>

                {/* Recent Activity Feed */}
                <div>
                    <h3 className="text-xl font-bold text-white mb-6">Recent Activity</h3>
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-4">
                        {(stats?.recentLogs && (stats.recentLogs as Record<string, unknown>[]).length > 0) ? (
                            (stats.recentLogs as Record<string, unknown>[]).map((log: Record<string, unknown>, i: number) => {
                                const userText = (log.users as Record<string, unknown>) ? ((log.users as Record<string, unknown>).full_name as string || (log.users as Record<string, unknown>).email as string) : 'System';
                                return (
                                    <div key={i} className="flex items-start">
                                        <div className="p-2 rounded-lg mr-3 bg-primary/10 flex-shrink-0">
                                            <Activity className="w-4 h-4 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-white">{log.action as string}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">by {userText}</p>
                                        </div>
                                        <span className="ml-auto text-[10px] bg-slate-800 text-slate-500 px-2 py-1 rounded-full whitespace-nowrap">
                                            {new Date(log.created_at as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-slate-500 text-center py-4 text-sm">No recent activity</div>
                        )}
                        <div className="pt-2">
                            <Link href="/admin/audit" className="text-xs text-primary hover:text-primary/80 flex items-center justify-center py-2 bg-slate-800/50 rounded-lg transition-colors">
                                View Full Audit Log
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon: Icon, color, bg }: { label: string; value: string | number; icon: React.ElementType; color: string; bg: string }) {
    return (
        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-slate-400 font-medium mb-1">{label}</p>
                    <h3 className="text-3xl font-bold text-white">{value}</h3>
                </div>
                <div className={`p-3 rounded-xl ${bg} ${color}`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
        </div>
    );
}
