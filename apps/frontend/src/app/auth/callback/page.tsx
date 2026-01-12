'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { authService } from '../../../services/auth.service';
import { useAuthStore } from '../../../store/auth.store';

export default function AuthCallbackPage() {
    const router = useRouter();
    const { setAuth } = useAuthStore();
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            try {
                const { data, error: err } = await supabase.auth.getSession();

                if (err) throw err;

                if (data.session) {
                    await processLogin(data.session);
                    return;
                }

                if (!window.location.hash && !window.location.search) {
                    setErrorMsg('No authentication token received.');
                }

            } catch (err: unknown) {
                const error = err as { message?: string };
                // eslint-disable-next-line no-console
                console.error('Error in auth callback:', error);
                setErrorMsg(error.message || 'Failed to complete registration');
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const processLogin = async (session: any) => {
            try {
                const userMetadata = session.user?.user_metadata || {};
                const user = {
                    id: session.user?.id as string,
                    email: session.user?.email as string,
                    fullName: (userMetadata.full_name as string) || (userMetadata.name as string) || (session.user?.email as string).split('@')[0],
                    role: 'user' as const,
                    createdAt: session.user?.created_at as string,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    googleId: session.user?.identities?.find((i: any) => i.provider === 'google')?.id as string
                };

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (authService as any).syncUser(user);

                // Initialize the auth store
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setAuth(user as any, session.access_token);

                router.push('/dashboard');
            } catch (err: unknown) {
                const error = err as { message?: string };
                // eslint-disable-next-line no-console
                console.error('❌ Sync Failed:', error);
                setErrorMsg('Profile sync failed: ' + (error.message || 'Unknown error'));
            }
        };

        handleCallback();
    }, [router]);

    if (errorMsg) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
                    <div className="bg-red-500/10 text-red-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                        <div className="w-8 h-8 border-4 border-red-500 rotate-45" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Authentication Error</h2>
                    <p className="text-slate-400 mb-8">{errorMsg}</p>
                    <button
                        onClick={() => router.push('/login')}
                        className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 transition-all"
                    >
                        Return to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-8" />
            <h2 className="text-2xl font-bold text-white mb-2 italic">Securing Your Connection</h2>
            <p className="text-slate-400 animate-pulse">Finalizing account verification...</p>
        </div>
    );
}
