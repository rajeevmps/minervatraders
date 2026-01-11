'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import PricingCard from '../../components/PricingCard';
import { useAuthStore } from '../../store/auth.store';
import { toast } from 'react-hot-toast';
import axios from 'axios';

// Define Plan Interface
interface Plan {
    id: string;
    name: string;
    price: number;
    duration: string;
    features: string[];
}

const FALLBACK_FEATURES = {
    'Monthly': ['Access to Premium Channel', 'Daily Market Updates', 'Priority Support'],
    'Quarterly': ['All Monthly Features', '10% Discount', 'Weekly Webinars', 'Exclusive Reports'],
    'Yearly': ['All Quarterly Features', '20% Discount', '1-on-1 Consultation', 'Lifetime Community Access']
};

export default function PricingPage() {
    const router = useRouter();
    const { isAuthenticated, user } = useAuthStore();
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Load Razorpay Script
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
    }, []);

    // Fetch Plans from Backend
    useEffect(() => {
        const fetchPlans = async () => {
            try {
                // Ensure API URL is correct
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
                const { data } = await axios.get(`${apiUrl}/subscriptions/plans`);

                // Transform backend data to frontend Plan interface
                // Backend fields might slightly differ (e.g. duration_days vs duration string)
                const formattedPlans = data.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    price: p.price,
                    duration: p.name === 'Monthly' ? 'month' : p.name === 'Quarterly' ? '3 months' : 'year',
                    features: FALLBACK_FEATURES[p.name as keyof typeof FALLBACK_FEATURES] || []
                }));

                setPlans(formattedPlans);
            } catch (err) {
                console.error('Failed to fetch plans', err);
                setError('Failed to load subscription plans.');
            }
        };

        fetchPlans();
    }, []);

    const handleSelectPlan = async (plan: Plan) => {
        if (!isAuthenticated) {
            toast.error('Please login to subscribe');
            router.push('/login');
            return;
        }

        setLoadingPlan(plan.id);

        try {
            const token = useAuthStore.getState().token;
            // 1. Create Order
            const { data: order } = await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}/payments/create-order`,
                { amount: plan.price, planId: plan.id }, // Now sending UUID!
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // 2. Open Razorpay
            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, // Add this to env
                amount: order.amount,
                currency: order.currency,
                name: 'MinervaTraders Platform',
                description: `Subscription - ${plan.name}`,
                order_id: order.id,
                handler: async function (response: any) {
                    toast.loading('Verifying payment via reliable webhook...', { id: 'verify-toast' });

                    // Poll for active subscription (Webhook confirmed)
                    const pollInterval = setInterval(async () => {
                        try {
                            const { data: sub } = await axios.get(
                                `${process.env.NEXT_PUBLIC_API_URL}/subscriptions`,
                                { headers: { Authorization: `Bearer ${token}` } }
                            );

                            if (sub && sub.status === 'active') {
                                clearInterval(pollInterval);
                                toast.success('Payment Confirmed! Redirecting...', { id: 'verify-toast' });
                                router.push('/dashboard');
                            }
                        } catch (e) {
                            // Ignore errors during polling
                        }
                    }, 2000);

                    // Timeout after 30 seconds
                    setTimeout(() => {
                        clearInterval(pollInterval);
                        toast.error('Payment taking longer than expected. Check dashboard later.', { id: 'verify-toast' });
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

            const rzp = new (window as any).Razorpay(options);
            rzp.open();

        } catch (error: any) {
            console.error('Subscription Error:', error);
            const message = error.response?.data?.message || 'Failed to initiate subscription';
            toast.error(message);
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
            </div>

            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto px-4 lg:px-8"
            >
                {plans.length > 0 ? (
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
                                onSelect={() => handleSelectPlan(plan)}
                                isLoading={loadingPlan === plan.id}
                            />
                        </motion.div>
                    ))
                ) : (
                    <div className="text-white text-center col-span-3">
                        {error ? <p className="text-red-400">{error}</p> : <p>Loading plans...</p>}
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
