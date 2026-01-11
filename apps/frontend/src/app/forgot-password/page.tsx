'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '../../components/ui/Button';
import GlassCard from '../../components/ui/GlassCard';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSent, setIsSent] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/update-password`,
            });

            if (error) throw error;
            setIsSent(true);
            toast.success('Reset link sent!');
        } catch (error: any) {
            console.error('Reset Error:', error);
            toast.error(error.message || 'Failed to send reset link');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-[80vh] items-center justify-center px-4 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md relative z-10"
            >
                <GlassCard className="p-8 md:p-10 space-y-6 backdrop-blur-2xl">
                    <div className="text-center space-y-2">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-primary flex items-center justify-center shadow-lg shadow-indigo-500/20 mx-auto mb-6">
                            <Mail className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight text-white">
                            Reset Password
                        </h2>
                        <p className="text-sm text-gray-400">
                            Enter your email to receive a recovery link
                        </p>
                    </div>

                    {!isSent ? (
                        <form onSubmit={handleReset} className="space-y-4 pt-2">
                            <div>
                                <input
                                    type="email"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full bg-slate-800/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                                />
                            </div>
                            <Button
                                type="submit"
                                isLoading={isLoading}
                                variant="primary"
                                className="w-full shadow-glow"
                            >
                                Send Reset Link
                            </Button>
                        </form>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-green-500/10 border border-green-500/20 rounded-lg p-6 text-center space-y-3"
                        >
                            <div className="flex justify-center mb-2">
                                <CheckCircle2 className="w-10 h-10 text-green-400" />
                            </div>
                            <h3 className="text-green-400 font-semibold">Check your inbox</h3>
                            <p className="text-sm text-gray-400">
                                We've sent a password reset link to <strong>{email}</strong>.
                            </p>
                        </motion.div>
                    )}

                    <div className="text-center">
                        <Link
                            href="/login"
                            className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Login
                        </Link>
                    </div>
                </GlassCard>
            </motion.div>
        </div>
    );
}
