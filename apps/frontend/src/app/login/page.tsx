'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/auth.store';
import { Button } from '../../components/ui/Button';
import GlassCard from '../../components/ui/GlassCard';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';



export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isEmailLoading, setIsEmailLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            });

            if (error) throw error;
        } catch (error: any) {
            console.error('Login Error:', error);
            toast.error(error.message || 'Failed to login with Google');
            setIsLoading(false);
        }
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsEmailLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            if (data.user) {
                // Check if user is admin
                const { data: adminRecord } = await supabase
                    .from('admins')
                    .select('user_id')
                    .eq('user_id', data.user.id)
                    .single();

                if (adminRecord) {
                    toast.success('Welcome Admin');
                    router.push('/admin/dashboard');
                } else {
                    toast.success('Welcome back!');
                    router.push('/dashboard');
                }
            }
        } catch (error: any) {
            toast.error(error.message || 'Invalid login credentials');
        } finally {
            setIsEmailLoading(false);
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
                            Welcome Back
                        </h2>
                        <p className="text-sm text-gray-400">
                            Sign in to access your premium dashboard
                        </p>
                    </div>

                    <div className="space-y-4 pt-4">
                        <form onSubmit={handleEmailLogin} className="space-y-4">
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
                            <div className="flex justify-end">
                                <Link
                                    href="/forgot-password"
                                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
                                >
                                    Forgot Password?
                                </Link>
                            </div>
                            <div>
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full bg-slate-800/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                                />
                            </div>
                            <Button
                                type="submit"
                                isLoading={isEmailLoading}
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
                                <span className="bg-[#0f172a] px-2 text-gray-500">Or continue with</span>
                            </div>
                        </div>

                        <Button
                            onClick={handleGoogleLogin}
                            isLoading={isLoading}
                            variant="secondary"
                            className="w-full relative flex items-center justify-center gap-3 h-12 text-base font-medium hover:bg-white/10 border-white/10"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                            Google
                        </Button>
                    </div>

                    <div className="text-center text-sm">
                        <span className="text-gray-400">Don't have an account? </span>
                        <Link href="/register" className="text-primary hover:text-primary/80 font-medium transition-colors">
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
