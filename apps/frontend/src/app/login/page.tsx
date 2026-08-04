'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import type { TelegramLoginPayload } from '@repo/types';

import { Button } from '../../components/ui/Button';
import GlassCard from '../../components/ui/GlassCard';
import TelegramLoginButton from '../../components/TelegramLoginButton';
import { useAuthStore } from '../../store/auth.store';
import { apiErrorMessage } from '../../services/api';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const login = useAuthStore((state) => state.login);
    const loginWithTelegram = useAuthStore((state) => state.loginWithTelegram);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isTelegramLoading, setIsTelegramLoading] = useState(false);

    /** Admins land on the admin dashboard; everyone else on their own. */
    const destinationFor = (role: string) => {
        const next = searchParams.get('next');
        if (next && next.startsWith('/') && !next.startsWith('//')) return next;
        return role === 'admin' ? '/admin/dashboard' : '/dashboard';
    };

    const handleEmailLogin = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsSubmitting(true);
        try {
            // Role comes from the authenticated API response. The browser used
            // to query the `admins` table directly with a public key to decide
            // this, which meant the admin roster was world-readable.
            const user = await login({ email, password });
            toast.success(user.role === 'admin' ? 'Welcome back, admin' : 'Welcome back!');
            router.push(destinationFor(user.role));
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Invalid email or password'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleTelegramAuth = async (payload: TelegramLoginPayload) => {
        setIsTelegramLoading(true);
        try {
            const user = await loginWithTelegram(payload);
            toast.success('Signed in with Telegram');
            router.push(destinationFor(user.role));
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Telegram sign-in failed'));
        } finally {
            setIsTelegramLoading(false);
        }
    };

    return (
        <div className="flex min-h-[80vh] items-center justify-center px-4 relative overflow-hidden">
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
                            <span className="text-white font-bold text-xl">M</span>
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight text-white">Welcome Back</h2>
                        <p className="text-sm text-gray-400">
                            Sign in to access your premium dashboard
                        </p>
                    </div>

                    <div className="space-y-4 pt-4">
                        <form onSubmit={handleEmailLogin} className="space-y-4">
                            <input
                                type="email"
                                placeholder="Email Address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                                className="w-full bg-slate-800/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                className="w-full bg-slate-800/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                            />
                            <Button
                                type="submit"
                                isLoading={isSubmitting}
                                variant="primary"
                                className="w-full shadow-glow"
                            >
                                Sign In
                            </Button>
                        </form>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-white/10" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-[#0f172a] px-2 text-gray-500">
                                    Or continue with
                                </span>
                            </div>
                        </div>

                        {/* Replaces Google OAuth: free, verified, and it supplies the
                            Telegram id needed to manage channel membership. */}
                        <div className="min-h-[48px] flex items-center justify-center">
                            {isTelegramLoading ? (
                                <span className="text-sm text-gray-400">Signing in…</span>
                            ) : (
                                <TelegramLoginButton onAuth={handleTelegramAuth} />
                            )}
                        </div>
                    </div>

                    <div className="text-center text-sm">
                        <span className="text-gray-400">Don&apos;t have an account? </span>
                        <Link
                            href="/register"
                            className="text-primary hover:text-primary/80 font-medium transition-colors"
                        >
                            Create one now
                        </Link>
                    </div>

                    <p className="text-center text-xs text-gray-500 pt-2">
                        By continuing, you agree to our Terms of Service and Privacy Policy.
                    </p>
                </GlassCard>
            </motion.div>
        </div>
    );
}

/**
 * useSearchParams() opts a component out of static rendering, so Next requires
 * it to sit inside a Suspense boundary — without one the page fails to
 * prerender at build time.
 */
export default function LoginPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-[80vh] items-center justify-center text-gray-400">
                    Loading…
                </div>
            }
        >
            <LoginForm />
        </Suspense>
    );
}
