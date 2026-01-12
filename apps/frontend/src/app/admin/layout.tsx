'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '../../store/auth.store';
import { createClient } from '@supabase/supabase-js';
import { Loader2, LayoutDashboard, LogOut, Settings, Users, CreditCard, Package, Receipt, Activity, Code } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { logout } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    useEffect(() => {
        const checkAdmin = async () => {
            // Check auth status via Supabase Auth (Session)
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                if (pathname !== '/admin/login') {
                    router.push('/admin/login');
                } else {
                    setIsLoading(false);
                }
                return;
            }

            // Check for admin existence
            const { data: adminApi, error } = await supabase
                .from('admins')
                .select('user_id')
                .eq('user_id', session.user.id)
                .single();

            if (error || !adminApi) {
                // Not admin
                if (pathname !== '/admin/login') {
                    // Force logout to clear invalid state if any
                    await supabase.auth.signOut();
                    logout();
                    router.push('/admin/login?error=not_admin');
                }
                setIsAdmin(false);
            } else {
                setIsAdmin(true);
                if (pathname === '/admin/login') {
                    router.push('/admin/dashboard');
                }
            }
            setIsLoading(false);
        };

        checkAdmin();
    }, [router, pathname, logout, supabase]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    // If on login page, render children without sidebar
    if (pathname === '/admin/login') {
        return <div className="min-h-screen bg-slate-950">{children}</div>;
    }

    if (!isAdmin) {
        return null; // Will have redirected
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex">
            {/* Sidebar */}
            <aside className="w-64 border-r border-slate-800 bg-slate-900/50 hidden md:flex flex-col">
                <div className="p-6">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent">
                        Admin Protocol
                    </h1>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    <Link href="/admin/dashboard">
                        <span className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${pathname === '/admin/dashboard'
                            ? 'bg-primary/20 text-primary border border-primary/20'
                            : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                            }`}>
                            <LayoutDashboard className="w-5 h-5" />
                            <span>Dashboard</span>
                        </span>
                    </Link>

                    <div className="pt-4 pb-2 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Database
                    </div>

                    {[
                        { name: 'Users', href: '/admin/users', icon: Users },
                        { name: 'Subscriptions', href: '/admin/subscriptions', icon: CreditCard },
                        { name: 'Plans', href: '/admin/plans', icon: Package },
                        { name: 'Payments', href: '/admin/payments', icon: Receipt },
                    ].map((item) => (
                        <Link key={item.name} href={item.href}>
                            <span className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${pathname.startsWith(item.href)
                                ? 'bg-primary/20 text-primary border border-primary/20'
                                : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                                }`}>
                                <item.icon className="w-5 h-5" />
                                <span>{item.name}</span>
                            </span>
                        </Link>
                    ))}

                    <div className="pt-4 pb-2 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        System
                    </div>

                    {[
                        { name: 'Audit Logs', href: '/admin/audit', icon: Activity },
                        { name: 'Webhooks', href: '/admin/webhooks', icon: Code },
                        { name: 'Settings', href: '/admin/settings', icon: Settings },
                    ].map((item) => (
                        <Link key={item.name} href={item.href}>
                            <span className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${pathname.startsWith(item.href)
                                ? 'bg-primary/20 text-primary border border-primary/20'
                                : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                                }`}>
                                <item.icon className="w-5 h-5" />
                                <span>{item.name}</span>
                            </span>
                        </Link>
                    ))}

                    <button
                        onClick={() => { logout(); router.push('/admin/login'); }}
                        className="flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors hover:bg-slate-800 text-slate-400 hover:text-red-400 w-full text-left mt-2"
                    >
                        <LogOut className="w-5 h-5" />
                        <span>Logout</span>
                    </button>
                </nav>

            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <div className="max-w-7xl mx-auto p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
