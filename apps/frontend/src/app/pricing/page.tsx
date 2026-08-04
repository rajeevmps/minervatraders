'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import PricingCard from '../../components/PricingCard';
import { useAuthStore } from '../../store/auth.store';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import api, { apiErrorMessage } from '../../services/api';

// Define Plan Interface
interface Plan {
    id: string;
    name: string;
    price: number;
    duration: string;
    features: string[];
}

/** The subset of Razorpay's order response the checkout widget needs. */
interface RazorpayOrder {
    id: string;
    amount: number;
    currency: string;
}

const FALLBACK_FEATURES = {
    Monthly: ['Access to Premium Channel', 'Daily Market Updates', 'Priority Support'],
    Quarterly: ['All Monthly Features', '10% Discount', 'Weekly Webinars', 'Exclusive Reports'],
    Yearly: [
        'All Quarterly Features',
        '20% Discount',
        '1-on-1 Consultation',
        'Lifetime Community Access',
    ],
};

export default function PricingPage() {
    const router = useRouter();
    const { isAuthenticated, user } = useAuthStore();
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isPageLoading, setIsPageLoading] = useState(true);
    // Tracks whether the third-party checkout.js has actually finished loading.
    // Previously nothing tracked this: clicking "Choose Plan" before the script
    // loaded called `new window.Razorpay(...)` while `window.Razorpay` was still
    // undefined, throwing and surfacing only as a generic "Failed to initiate
    // subscription" toast with no indication of the real cause.
    const [razorpayStatus, setRazorpayStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

    // Load Razorpay Script
    useEffect(() => {
        // Already present (e.g. fast remount) — don't inject a second copy.
        if (typeof window !== 'undefined' && (window as unknown as { Razorpay?: unknown }).Razorpay) {
            setRazorpayStatus('ready');
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => setRazorpayStatus('ready');
        script.onerror = () => setRazorpayStatus('failed');
        document.body.appendChild(script);

        return () => {
            script.onload = null;
            script.onerror = null;
        };
    }, []);

    // Fetch Plans from Backend
    useEffect(() => {
        const fetchPlans = async () => {
            try {
                // Ensure API URL is correct
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
                // eslint-disable-next-line no-console
                console.log('Fetching plans from:', apiUrl); // Debug log
                const { data } = await axios.get(`${apiUrl}/subscriptions/plans`);

                // Transform backend data to frontend Plan interface
                const formattedPlans = data.data.map((p: Record<string, unknown>) => ({
                    id: p.id as string,
                    name: p.name as string,
                    price: p.price as number,
                    duration:
                        p.name === 'Monthly'
                            ? 'month'
                            : p.name === 'Quarterly'
                                ? '3 months'
                                : 'year',
                    features: FALLBACK_FEATURES[p.name as keyof typeof FALLBACK_FEATURES] || [],
                }));

                setPlans(formattedPlans);
            } catch (err) {
                console.error('Failed to fetch plans', err);
                setError('Failed to load subscription plans. Please check your connection.');
            } finally {
                setIsPageLoading(false);
            }
        };

        fetchPlans();
    }, []);

    const handleSelectPlan = async (plan: Record<string, unknown>) => {
        if (!isAuthenticated) {
            toast.error('Please login to subscribe');
            router.push('/login');
            return;
        }

        if (razorpayStatus === 'failed') {
            toast.error(
                'The payment gateway could not load. Check your connection or ad-blocker and try again.'
            );
            return;
        }
        if (razorpayStatus !== 'ready') {
            toast.error('Payment gateway is still loading — please try again in a moment.');
            return;
        }

        setLoadingPlan(plan.id as string);

        try {
            // All calls go through the shared client: it attaches a live access
            // token and transparently refreshes it. These call sites previously
            // used a stale token read straight out of the persisted store.
            const { data: response } = await api.post<{ data: RazorpayOrder }>(
                '/payments/create-order',
                { planId: plan.id }
            );

            const order = response.data;

            // 2. Open Razorpay
            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, // Add this to env
                amount: order.amount,
                currency: order.currency,
                name: 'MinervaTraders Platform',
                description: `Subscription - ${plan.name}`,
                order_id: order.id,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                handler: async function (rzpResponse: any) {
                    toast.loading('Verifying payment...', { id: 'verify-toast' });

                    try {
                        await api.post('/payments/verify', {
                            orderId: rzpResponse.razorpay_order_id,
                            paymentId: rzpResponse.razorpay_payment_id,
                            signature: rzpResponse.razorpay_signature,
                        });

                        toast.success('Payment verified! Redirecting…', { id: 'verify-toast' });
                        router.push('/dashboard');
                        return;
                    } catch {
                        // Verification and the webhook race each other; if the
                        // webhook won, fulfilment is already done and the poll
                        // below will observe it. Activation is idempotent, so
                        // neither path can double-charge or double-activate.
                    }

                    const pollInterval = setInterval(async () => {
                        try {
                            const { data } = await api.get<{ data?: { status?: string } }>(
                                '/subscriptions'
                            );

                            if (data.data?.status === 'active') {
                                clearInterval(pollInterval);
                                toast.success('Payment confirmed! Redirecting…', {
                                    id: 'verify-toast',
                                });
                                router.push('/dashboard');
                            }
                        } catch {
                            // Transient failures are expected while polling.
                        }
                    }, 2000);

                    // Timeout after 30 seconds
                    setTimeout(() => {
                        clearInterval(pollInterval);
                        toast.error(
                            'Processing taking longer than expected. Please check your dashboard in a moment.',
                            { id: 'verify-toast' }
                        );
                        router.push('/dashboard');
                    }, 30000);
                },
                prefill: {
                    name: user?.fullName,
                    email: user?.email,
                },
                theme: {
                    color: '#2563EB',
                },
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const RazorpayCtor = (window as any).Razorpay;
            if (!RazorpayCtor) {
                // Belt-and-suspenders: razorpayStatus said 'ready', but guard
                // against it anyway rather than letting this throw uncaught.
                toast.error('Payment gateway is not available right now. Please refresh and try again.');
                return;
            }
            const rzp = new RazorpayCtor(options);
            rzp.open();
        } catch (error: unknown) {
            toast.error(apiErrorMessage(error, 'Failed to initiate subscription'));
        } finally {
            setLoadingPlan(null);
        }
    };

    return (
        <div className="pb-24 pt-10">
            <div className="text-center max-w-3xl mx-auto mb-16 px-4">
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-6"
                >
                    Simple, Transparent Pricing
                </motion.h2>
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-xl text-gray-400"
                >
                    Unlock institutional-grade market insights. Join the elite community today.
                </motion.p>
                {razorpayStatus === 'failed' && (
                    <p className="mt-4 text-sm text-amber-400/90">
                        The payment gateway couldn&apos;t load. Disable any ad-blocker for this site
                        and refresh the page.
                    </p>
                )}
            </div>

            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto px-4 lg:px-8"
            >
                {isPageLoading ? (
                    <div className="text-white text-center col-span-3 py-12">
                        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="animate-pulse text-indigo-400">Connecting to server...</p>
                        <p className="text-xs text-slate-600 mt-2">
                            (This might take a minute if the server is waking up)
                        </p>
                    </div>
                ) : plans.length > 0 ? (
                    plans.map((plan, index) => (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 + index * 0.1 }}
                        >
                            <PricingCard
                                planName={plan.name}
                                price={plan.price.toString()}
                                duration={plan.duration}
                                features={plan.features}
                                isPopular={plan.name === 'Quarterly'}
                                onSelect={() =>
                                    handleSelectPlan(plan as unknown as Record<string, unknown>)
                                }
                                isLoading={loadingPlan === plan.id}
                            />
                        </motion.div>
                    ))
                ) : (
                    <div className="text-white text-center col-span-3 py-12">
                        {error ? (
                            <div>
                                <p className="text-red-400 mb-2">{error}</p>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="text-sm underline opacity-75 hover:opacity-100"
                                >
                                    Try Again
                                </button>
                            </div>
                        ) : (
                            <p className="text-slate-400">
                                No subscription plans found at the moment.
                            </p>
                        )}
                    </div>
                )}
            </motion.div>

            {/* Trust Badges */}
            <div className="mt-20 pt-10 border-t border-white/5 flex flex-wrap justify-center gap-8 md:gap-16 opacity-50">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm font-medium">Secure Payment</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-sm font-medium">Instant Access</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-sm font-medium">Cancel Anytime</span>
                </div>
            </div>
        </div>
    );
}
