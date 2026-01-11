'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../../store/auth.store';
import { supabase } from '../../../lib/supabase';
import Loader from '../../../components/ui/Loader';
import { toast } from 'react-hot-toast';

export default function AuthCallback() {
    const router = useRouter();
    const { setAuth } = useAuthStore();
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const processingRef = useRef(false);

    useEffect(() => {
        if (processingRef.current) return;
        processingRef.current = true;

        const handleAuth = async () => {
            console.log('🔄 Auth Callback Initiated');
            try {
                // 1. Check for existing session (Implicit Flow / Magic Link)
                const { data: { session }, error } = await supabase.auth.getSession();

                if (session) {
                    console.log('✅ Session Found (Immediate)');
                    await processLogin(session);
                    return;
                }

                // 2. Check for Code (PKCE Flow)
                const code = new URL(window.location.href).searchParams.get('code');
                if (code) {
                    console.log('🔑 Auth Code Found, Exchanging...');
                    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

                    if (exchangeError) throw exchangeError;

                    if (data.session) {
                        console.log('✅ Token Exchange Successful');
                        await processLogin(data.session);
                        return;
                    }
                }

                // 3. No Session, No Code -> Show Error (Do not redirect automatically)
                console.warn('⚠️ No session or code found in URL:', window.location.href);
                setErrorMsg('No authentication token received. URL: ' + window.location.href);
                // router.push('/login'); // DISABLE AUTO REDIRECT for debugging

            } catch (err: any) {
                console.error('❌ Auth Callback Critical Fail:', err);
                setErrorMsg(err.message || 'Authentication processing failed');
            }
        };

        const processLogin = async (session: any) => {
            try {
                const user = {
                    id: session.user.id,
                    email: session.user.email!,
                    fullName: session.user.user_metadata.full_name || session.user.user_metadata.name || session.user.email!.split('@')[0],
                    role: 'user',
                    created_at: session.user.created_at,
                    googleId: session.user.identities?.find((i: any) => i.provider === 'google')?.id
                };

                console.log('👤 User Processing:', user.id);

                // Check Admin Status (Allow failure)
                const { data: adminRecord, error: adminError } = await supabase
                    .from('admins')
                    .select('user_id')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (adminError) {
                    console.warn('⚠️ Admin check warning (ignoring):', adminError.message);
                }

                // Update Local State
                setAuth(user, session.access_token);
                toast.success(`Welcome, ${user.fullName}`);

                // Decide Redirect
                if (adminRecord) {
                    console.log('👑 Admin Detected -> /admin/dashboard');
                    router.push('/admin/dashboard');
                } else {
                    console.log('👋 Regular User -> /dashboard');
                    router.push('/dashboard');
                }
            } catch (innerErr) {
                console.error('Login Processing Logic Error:', innerErr);
                router.push('/dashboard'); // Fallback safety
            }
        };

        handleAuth();
    }, [router, setAuth]);

    if (errorMsg) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 flex-col gap-4 p-4">
                <div className="bg-red-50 text-red-600 p-6 rounded-lg max-w-md text-center border border-red-200 shadow-sm">
                    <h3 className="font-bold text-lg mb-2">Login Connection Failed</h3>
                    <p className="text-sm op-80 mb-4">{errorMsg}</p>
                    <button
                        onClick={() => router.push('/login')}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <div className="text-center">
                <Loader size="lg" className="mx-auto mb-4" />
                <p className="text-gray-600 font-medium">Authenticating secured session...</p>
            </div>
        </div>
    );
}
