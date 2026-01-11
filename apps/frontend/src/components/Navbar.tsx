'use client';

import Link from 'next/link';
import { useAuthStore } from '../store/auth.store';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, User, LogOut, CreditCard, LayoutDashboard, Shield } from 'lucide-react';
import { Button } from './ui/Button';

import { usePathname } from 'next/navigation';

export default function Navbar() {
    const { isAuthenticated, logout, user } = useAuthStore();
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Don't show public navbar on admin pages
    if (pathname?.startsWith('/admin')) {
        return null;
    }

    const navLinks = [
        { name: 'Features', href: '/features' },
        { name: 'Pricing', href: '/pricing' },
        { name: 'About', href: '/about' },

    ];

    return (
        <>
            <motion.nav
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled || isMobileMenuOpen ? 'bg-background/80 backdrop-blur-md border-b border-white/10' : 'bg-transparent'
                    }`}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <Link href="/" className="flex items-center space-x-2 group">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-all">
                                <span className="text-white font-bold text-lg">T</span>
                            </div>
                            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                MinervaTraders
                            </span>
                        </Link>

                        {/* Desktop Nav */}
                        <div className="hidden md:flex items-center space-x-8">
                            {!isAuthenticated && navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
                                >
                                    {link.name}
                                </Link>
                            ))}

                            {isAuthenticated ? (
                                <div className="flex items-center space-x-4">
                                    {user?.role === 'admin' && (
                                        <Link href="/admin/dashboard">
                                            <Button variant="ghost" className="!px-2 text-red-400 hover:text-red-300 hover:bg-red-400/10">
                                                <Shield className="w-5 h-5 mr-2" />
                                                Admin
                                            </Button>
                                        </Link>
                                    )}
                                    <Link href="/dashboard">
                                        <Button variant="ghost" className="!px-2">
                                            <LayoutDashboard className="w-5 h-5 mr-2" />
                                            Dashboard
                                        </Button>
                                    </Link>
                                    <Button onClick={logout} variant="outline" size="sm">
                                        <LogOut className="w-4 h-4 mr-2" />
                                        Logout
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center space-x-4">
                                    <Link href="/login">
                                        <Button variant="ghost">Login</Button>
                                    </Link>
                                    <Link href="/register">
                                        <Button variant="primary" className="shadow-glow">
                                            Get Started
                                        </Button>
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Mobile Menu Button */}
                        <div className="md:hidden">
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu */}
                <AnimatePresence>
                    {isMobileMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="md:hidden bg-background/95 backdrop-blur-xl border-b border-white/10 overflow-hidden"
                        >
                            <div className="px-4 pt-2 pb-6 space-y-4">
                                {!isAuthenticated && navLinks.map((link) => (
                                    <Link
                                        key={link.name}
                                        href={link.href}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="block px-4 py-3 rounded-xl text-base font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                                    >
                                        {link.name}
                                    </Link>
                                ))}

                                <div className="h-px bg-white/10 my-4" />

                                {isAuthenticated ? (
                                    <div className="space-y-3">
                                        <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                                            <Button variant="secondary" className="w-full justify-start">
                                                <LayoutDashboard className="w-5 h-5 mr-3" />
                                                Dashboard
                                            </Button>
                                        </Link>
                                        <Button onClick={() => { logout(); setIsMobileMenuOpen(false); }} variant="outline" className="w-full justify-start">
                                            <LogOut className="w-5 h-5 mr-3" />
                                            Logout
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                                            <Button variant="secondary" className="w-full">
                                                Log In
                                            </Button>
                                        </Link>
                                        <Link href="/register" onClick={() => setIsMobileMenuOpen(false)}>
                                            <Button variant="primary" className="w-full shadow-glow">
                                                Get Started
                                            </Button>
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.nav>
        </>
    );
}
