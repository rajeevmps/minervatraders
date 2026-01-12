'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Button } from '../../../components/ui/Button';
import { toast } from 'react-hot-toast';
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../../store/auth.store';

export default function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const error = searchParams.get('error');
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { setAuth } = useAuthStore();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) throw authError;

            if (authData.user) {
                const { data: adminRecord, error: adminError } = await supabase
                    .from('admins')
                    .select('user_id')
                    .eq('user_id', authData.user.id)
                    .single();

                if (adminError || !adminRecord) {
                    await supabase.auth.signOut();
                    toast.error('Access denied: Insufficient privileges.');
                } else {
                    setAuth({
                        id: authData.user.id,
                        email: authData.user.email!,
                        role: 'admin' as const
                    }, authData.session?.access_token || '');

                    toast.success('Welcome back, Commander');
                    router.push('/admin/dashboard');
                }
            }
        } catch (err: unknown) {
            const error = err as { message?: string };
            toast.error(error.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen relative overflow-hidden">
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 w-full max-w-md p-8 bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 mb-4">
                        <ShieldCheck className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Admin Portal</h1>
                    <p className="text-slate-400 mt-2">Secure Restricted Access</p>
                </div>

                {error === 'not_admin' && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm">Access denied. You do not have admin privileges.</span>
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Email Identity</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-slate-600"
                            placeholder="admin@minervatraders.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Security Key</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-slate-600"
                            placeholder="••••••••"
                        />
                    </div>

                    <Button
                        variant="primary"
                        className="w-full flex justify-center py-6 text-lg font-semibold shadow-glow"
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Authenticate System'}
                    </Button>
                </form>
            </div>
        </div>
    );
}
