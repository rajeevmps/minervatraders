'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/auth.store';
import { Button } from '../../components/ui/Button';
import GlassCard from '../../components/ui/GlassCard';
import Loader from '../../components/ui/Loader';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { motion } from 'framer-motion';
import { User, CreditCard, ExternalLink, Calendar, LogOut, Send } from 'lucide-react';
import Link from 'next/link';

interface Subscription {
    id: string;
    status: string;
    start_date: string;
    end_date: string;
    plan: {
        name: string;
    };
}

export default function DashboardPage() {
    const router = useRouter();
    const { user, token, logout, isAuthenticated } = useAuthStore();
    const [isLoading, setIsLoading] = useState(true);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [telegramLink, setTelegramLink] = useState<string | null>(null);

    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }

        const fetchData = async () => {
            try {
                const subResponse = await axios.get(
                    `${process.env.NEXT_PUBLIC_API_URL}/subscriptions`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                if (subResponse.data && !subResponse.data.message) {
                    setSubscription(subResponse.data);
                }
            } catch (error) {
                console.error('Dashboard Fetch Error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [isAuthenticated, router, token]);

    // Fetch link on mount if active
    useEffect(() => {
        if (subscription?.status === 'active') {
            handleGetTelegramLink();
        }
    }, [subscription]);

    const handleGetTelegramLink = async () => {
        try {
            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}/telegram/invite`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data && response.data.inviteLink) {
                setTelegramLink(response.data.inviteLink);
            }
        } catch (error: any) {
            console.error('Telegram Invite Error:', error);
            // Optionally set error state or just fail silently if polling
        }
    };

    useEffect(() => {
        if (user?.role === 'admin') {
            router.replace('/admin/dashboard');
        }
    }, [user, router]);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader size="lg" />
            </div>
        );
    }

    if (user?.role === 'admin') {
        return (
            <div className="min-h-screen py-12 px-4 flex items-center justify-center">
                <Loader size="lg" />
                <span className="ml-3 text-slate-400">Redirecting to Admin Panel...</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* Greeting Section */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6"
                >
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white">Dashboard</h1>
                        <p className="text-gray-400 mt-1 max-w-lg">Welcome back, <span className="text-primary font-medium">{user?.fullName || 'User'}</span></p>
                    </div>
                    <Button variant="outline" onClick={() => router.push('/pricing')} className="w-full md:w-auto">
                        Upgrade Plan
                    </Button>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                    {/* Main Subscription Card */}
                    <div className="md:col-span-2">
                        <GlassCard className="h-full p-5 sm:p-6 md:p-8" hoverEffect={false}>
                            <h2 className="text-lg sm:text-xl font-semibold mb-6 flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-primary" />
                                Current Subscription
                            </h2>

                            {subscription && subscription.status === 'active' ? (
                                <div className="space-y-6">
                                    <div className="flex flex-col gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                                        <div>
                                            <p className="text-sm text-gray-400 mb-1">Active Plan</p>
                                            <div className="flex items-center gap-3">
                                                <p className="text-xl sm:text-2xl font-bold text-white">{subscription.plan.name}</p>
                                                <div className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
                                                    Active
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Renewal Date</span>
                                            <span className="text-white font-medium">
                                                {new Date(subscription.end_date).toLocaleDateString('en-GB', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                            </span>
                                        </div>

                                        {/* Dynamic Progress Bar */}
                                        {(() => {
                                            const start = new Date(subscription.start_date || new Date().toISOString());

                                            const end = new Date(subscription.end_date);
                                            const today = new Date();

                                            const totalDuration = end.getTime() - start.getTime();
                                            const elapsed = today.getTime() - start.getTime();

                                            // Ensure progress is 0-100
                                            let percent = Math.round((elapsed / totalDuration) * 100);
                                            if (percent < 0) percent = 0;
                                            if (percent > 100) percent = 100;

                                            // Calculate remaining days
                                            const diffTime = end.getTime() - today.getTime();
                                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                            const displayDays = diffDays > 0 ? diffDays : 0;

                                            return (
                                                <>
                                                    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-primary rounded-full transition-all duration-500"
                                                            style={{ width: `${percent}%` }}
                                                        />
                                                    </div>
                                                    <p className="text-xs text-right text-gray-500">
                                                        {displayDays} days remaining
                                                    </p>
                                                </>
                                            );
                                        })()}
                                    </div>

                                    <div className="pt-4">
                                        <div className="flex flex-col gap-4">
                                            {telegramLink ? (
                                                <a
                                                    href={telegramLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-center gap-2 w-full bg-[#eca84d] hover:bg-[#d6933c] text-white px-6 py-3 rounded-lg font-medium transition-colors"
                                                >
                                                    <Send className="w-5 h-5" />
                                                    Join Telegram Channel
                                                </a>
                                            ) : (
                                                <div className="flex flex-col gap-3">
                                                    <p className="text-sm text-gray-400 text-center">Step 1: Connect your Telegram account to verify your subscription.</p>
                                                    <a
                                                        href={`https://t.me/MinervaTradersBot?start=${user?.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center justify-center gap-2 w-full bg-[#229ED9] hover:bg-[#1a8bc0] text-white px-6 py-3 rounded-lg font-medium transition-colors"
                                                    >
                                                        <Send className="w-5 h-5" />
                                                        Connect Telegram
                                                    </a>
                                                </div>
                                            )}
                                            <p className="text-xs text-center text-gray-500/80">
                                                {telegramLink
                                                    ? "Click to request to join. Our bot will auto-approve you."
                                                    : "You must connect your Telegram account first."}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-10 px-4">
                                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                                        <LogOut className="w-8 h-8 text-gray-500" />
                                    </div>
                                    <h3 className="text-xl font-medium text-white mb-2">No Active Subscription</h3>
                                    <p className="text-gray-400 mb-6 max-w-sm mx-auto">Unlock exclusive signals and market insights by subscribing to one of our premium plans.</p>
                                    <Link href="/pricing" className="block sm:inline-block w-full sm:w-auto">
                                        <Button size="lg" className="w-full sm:w-auto shadow-lg shadow-indigo-500/20">
                                            View Plans
                                        </Button>
                                    </Link>
                                </div>
                            )}
                        </GlassCard>
                    </div>

                    {/* Quick Access / Profile Side */}
                    <div className="space-y-8">
                        <GlassCard className="p-5 sm:p-6">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <User className="w-4 h-4 text-primary" />
                                Profile Info
                            </h3>
                            <div className="space-y-4">
                                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Email</p>
                                    <p className="text-sm font-medium text-white truncate">{user?.email}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Member Since</p>
                                    <p className="text-sm font-medium text-white">
                                        {user?.created_at
                                            ? new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                            : 'N/A'}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-6 pt-6 border-t border-white/5">
                                <Button variant="ghost" onClick={() => router.push('/pricing')} className="w-full text-primary hover:text-white hover:bg-primary/10 border border-primary/20 transition-all">
                                    Renew Plan
                                </Button>
                            </div>
                        </GlassCard>
                    </div>
                </div>
            </div>
        </div>
    );
}
