'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '../../components/ui/Button';
import GlassCard from '../../components/ui/GlassCard';
import TelegramLoginButton, {
    isTelegramLoginConfigured,
} from '../../components/TelegramLoginButton';
import { toast } from 'react-hot-toast';
import type { TelegramLoginPayload } from '@repo/types';
import { useAuthStore } from '../../store/auth.store';
import { apiErrorMessage } from '../../services/api';

export default function RegisterPage() {
    const router = useRouter();
    const registerUser = useAuthStore((state) => state.register);
    const loginWithTelegram = useAuthStore((state) => state.loginWithTelegram);

    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // Registration signs the user straight in — there is no email
            // confirmation step, so bouncing them to /login would be a dead end.
            await registerUser({ email, password, fullName });
            toast.success('Account created. Welcome!');
            router.push('/dashboard');
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Failed to create account'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleTelegramAuth = async (payload: TelegramLoginPayload) => {
        setIsLoading(true);
        try {
            await loginWithTelegram(payload);
            toast.success('Signed in with Telegram');
            router.push('/dashboard');
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Telegram sign-in failed'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-[80vh] items-center justify-center px-4 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md relative z-10"
            >
                <GlassCard className="p-8 md:p-10 space-y-8 backdrop-blur-2xl">
                    <div className="text-center space-y-2">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 mx-auto mb-6">
                            <span className="text-white font-bold text-xl">T</span>
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight text-white">
                            Create Account
                        </h2>
                        <p className="text-sm text-gray-400">
                            Join the elite trading community today
                        </p>
                    </div>

                    <form onSubmit={handleSignup} className="space-y-4 pt-4">
                        <div>
                            <input
                                type="text"
                                placeholder="Full Name"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                                className="w-full bg-slate-800/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                            />
                        </div>
                        <div>
                            <input
                                type="email"
                                placeholder="Email Address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full bg-slate-800/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                            />
                        </div>
                        <div>
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                // Must match the server policy in utils/validators.
                                minLength={10}
                                className="w-full bg-slate-800/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                            />
                            <p className="mt-1 text-xs text-gray-500">At least 10 characters.</p>
                        </div>
                        <Button
                            type="submit"
                            isLoading={isLoading}
                            variant="primary"
                            className="w-full shadow-glow"
                        >
                            Sign Up
                        </Button>
                    </form>

                    {isTelegramLoginConfigured && (
                        <>
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-white/10" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-[#0f172a] px-2 text-gray-500">
                                        Or sign up with
                                    </span>
                                </div>
                            </div>

                            <div className="min-h-[48px] flex items-center justify-center">
                                <TelegramLoginButton onAuth={handleTelegramAuth} />
                            </div>
                        </>
                    )}

                    <div className="text-center text-sm">
                        <span className="text-gray-400">Already have an account? </span>
                        <Link href="/login" className="text-primary hover:text-primary/80 font-medium transition-colors">
                            Sign in
                        </Link>
                    </div>
                </GlassCard>
            </motion.div>
        </div>
    );
}
