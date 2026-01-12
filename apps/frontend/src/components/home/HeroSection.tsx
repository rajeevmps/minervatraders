'use client';

import { motion, Variants } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface HeroSectionProps {
    fadeIn: Variants;
    stagger: Variants;
}

export const HeroSection = ({ fadeIn, stagger }: HeroSectionProps) => {
    return (
        <section className="relative w-full min-h-[90vh] flex flex-col items-center justify-center text-center px-4 pt-16">
            {/* Background Glows */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] pointer-events-none opacity-50 animate-pulse" />
            <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none opacity-50" />

            <motion.div
                initial="initial"
                animate="animate"
                variants={stagger}
                className="relative z-10 max-w-5xl mx-auto space-y-8"
            >
                <motion.div variants={fadeIn} className="flex justify-center">
                    <div className="px-5 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-indigo-300 backdrop-blur-md shadow-lg shadow-indigo-500/10 flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        v2.0 Now Live: Enhanced Signal Latency
                    </div>
                </motion.div>

                <motion.h1
                    variants={fadeIn}
                    className="text-6xl md:text-8xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-gray-400 leading-[1.05]"
                >
                    Master the Market with <br />
                    <span className="text-primary inline-block mt-2">Executive Intelligence</span>
                </motion.h1>

                <motion.p
                    variants={fadeIn}
                    suppressHydrationWarning
                    className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto leading-relaxed"
                >
                    <span>Join </span>
                    <span className="text-white font-semibold">10,000+ elite traders</span>
                    <span> getting real-time signals, institutional-grade analysis, and weekly reports directly on Telegram.</span>
                </motion.p>

                <motion.div
                    variants={fadeIn}
                    className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8"
                >
                    <Link href="/register" className="w-full sm:w-auto">
                        <Button
                            size="lg"
                            className="w-full sm:w-auto shadow-xl shadow-indigo-500/30 text-lg px-8 py-6 h-auto transition-transform hover:scale-105"
                        >
                            Start Free Trial
                            <ArrowRight className="ml-2 w-5 h-5" />
                        </Button>
                    </Link>
                    <Link href="/features" className="w-full sm:w-auto">
                        <Button
                            variant="outline"
                            size="lg"
                            className="w-full sm:w-auto text-lg px-8 py-6 h-auto hover:bg-white/5"
                        >
                            Explore Features
                        </Button>
                    </Link>
                </motion.div>

                {/* Stats overlay */}
                <motion.div
                    variants={fadeIn}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-16 border-t border-white/5 mt-16"
                >
                    <div>
                        <p className="text-3xl font-bold text-white">89%</p>
                        <p className="text-sm text-gray-500">Win Rate</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-white">50k+</p>
                        <p className="text-sm text-gray-500">Signals Sent</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-white">24/7</p>
                        <p className="text-sm text-gray-500">Support</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-white">4.9/5</p>
                        <p className="text-sm text-gray-500">User Rating</p>
                    </div>
                </motion.div>
            </motion.div>
        </section>
    );
};
