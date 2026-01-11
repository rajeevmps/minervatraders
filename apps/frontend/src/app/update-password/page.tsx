'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '../../components/ui/Button';
import GlassCard from '../../components/ui/GlassCard';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Lock, Loader2 } from 'lucide-react';

export default function UpdatePasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Verify we have a session (user clicked magic link)
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast.error('Invalid or expired reset link. Please try again.');
                router.push('/forgot-password');
            }
        };
        checkSession();
    }, []);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        setIsLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            toast.success('Password updated successfully!');
            router.push('/login');

        } catch (error: any) {
            console.error('Update Error:', error);
            toast.error(error.message || 'Failed to update password');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-[80vh] items-center justify-center px-4 relative overflow-hidden">
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
                            <Lock className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight text-white">
                            Set New Password
                        </h2>
                        <p className="text-sm text-gray-400">
                            Secure your account with a strong password
                        </p>
                    </div>

                    <form onSubmit={handleUpdate} className="space-y-4 pt-2">
                        <div>
                            <input
                                type="password"
                                placeholder="New Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full bg-slate-800/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                            />
                        </div>
                        <div>
                            <input
                                type="password"
                                placeholder="Confirm New Password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full bg-slate-800/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                            />
                        </div>

                        <Button
                            type="submit"
                            isLoading={isLoading}
                            variant="primary"
                            className="w-full shadow-glow"
                        >
                            Update Password
                        </Button>
                    </form>
                </GlassCard>
            </motion.div>
        </div>
    );
}
