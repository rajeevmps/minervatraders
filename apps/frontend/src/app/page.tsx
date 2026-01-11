'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Shield, Zap, TrendingUp, Users } from 'lucide-react';
import { Button } from '../components/ui/Button';
import GlassCard from '../components/ui/GlassCard';

export default function Home() {
    const fadeIn = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.5 } }
    };

    const stagger = {
        animate: {
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    return (
        <div className="flex flex-col items-center justify-center space-y-32 pb-20 overflow-hidden">

            {/* HERO SECTION */}
            {/* HERO SECTION */}
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
                        className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto leading-relaxed"
                    >
                        Join <span className="text-white font-semibold">10,000+ elite traders</span> getting real-time signals, institutional-grade analysis, and weekly reports directly on Telegram.
                    </motion.p>

                    <motion.div variants={fadeIn} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
                        <Link href="/register" className="w-full sm:w-auto">
                            <Button size="lg" className="w-full sm:w-auto shadow-xl shadow-indigo-500/30 text-lg px-8 py-6 h-auto transition-transform hover:scale-105">
                                Start Free Trial
                                <ArrowRight className="ml-2 w-5 h-5" />
                            </Button>
                        </Link>
                        <Link href="/features" className="w-full sm:w-auto">
                            <Button variant="outline" size="lg" className="w-full sm:w-auto text-lg px-8 py-6 h-auto hover:bg-white/5">
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

            {/* FEATURES GRID */}
            <section className="w-full relative px-4">
                <div className="text-center mb-16 space-y-4">
                    <h2 className="text-3xl md:text-5xl font-bold">Why Top Traders Choose Us</h2>
                    <p className="text-gray-400 text-lg">Everything you need to stay ahead of the curve.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
                    {[
                        { icon: Zap, title: "Real-time Signals", desc: "Instant notifications for breakouts, trend reversals, and high-probability setups." },
                        { icon: Shield, title: "Risk Management", desc: "Every signal includes precise entry, stop-loss, and take-profit levels." },
                        { icon: TrendingUp, title: "Market Analysis", desc: "Daily pre-market reports and weekly outcome reviews to keep you informed." },
                    ].map((feature, i) => (
                        <GlassCard key={i} hoverEffect className="p-8 space-y-4 group">
                            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <feature.icon className="w-7 h-7 text-primary" />
                            </div>
                            <h3 className="text-xl font-semibold">{feature.title}</h3>
                            <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
                        </GlassCard>
                    ))}
                </div>
            </section>

            {/* TRUST / SOCIAL PROOF */}
            <section className="w-full py-20 border-y border-white/5 bg-white/[0.02]">
                <div className="max-w-7xl mx-auto px-4 text-center space-y-12">
                    <p className="text-sm font-semibold tracking-widest text-gray-500 uppercase">Trusted by industry leaders</p>

                    <div className="flex flex-wrap justify-center gap-12 gap-y-8 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                        {/* Mock Logos */}
                        {['Binance', 'Coinbase', 'TradingView', 'Bloomberg', 'Forbes'].map((logo) => (
                            <span key={logo} className="text-2xl font-bold font-serif">{logo}</span>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-8">
                        {[
                            { label: 'Active Members', value: '12K+' },
                            { label: 'Win Rate', value: '89%' },
                            { label: 'Signals/Month', value: '150+' },
                            { label: 'Support', value: '24/7' },
                        ].map((stat) => (
                            <div key={stat.label} className="space-y-1">
                                <div className="text-3xl md:text-4xl font-bold text-white">{stat.value}</div>
                                <div className="text-sm text-gray-500">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ SECTION */}
            <section className="w-full max-w-3xl mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold">Frequently Asked Questions</h2>
                </div>
                <div className="space-y-4">
                    {[
                        { q: "How do I receive the signals?", a: "Once you subscribe, you'll get an instant link to our private Telegram channel where all signals and reports are posted in real-time." },
                        { q: "Can I cancel anytime?", a: "Absolutely. You can manage your subscription directly from your dashboard and cancel whenever you like. No hidden fees." },
                        { q: "What is your success rate?", a: "We maintain a transparent 89% win rate over the last 12 months. All our past performance is verifiable in the channel history." },
                        { q: "Do you offer refunds?", a: "We offer a 7-day money-back guarantee if you are not satisfied with the quality of our service." },
                    ].map((item, i) => (
                        <GlassCard key={i} className="p-6">
                            <h3 className="text-lg font-semibold mb-2">{item.q}</h3>
                            <p className="text-gray-400">{item.a}</p>
                        </GlassCard>
                    ))}
                </div>
            </section>

            {/* BOTTOM CTA */}
            <section className="w-full max-w-5xl mx-auto px-4 text-center">
                <div className="relative overflow-hidden rounded-3xl bg-primary/10 border border-primary/20 p-12 md:p-20 space-y-8">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />

                    <h2 className="text-4xl md:text-5xl font-bold">Ready to level up?</h2>
                    <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                        Don't miss the next big move. Join our community today and start trading with confidence.
                    </p>
                    <Link href="/register" className="inline-block">
                        <Button size="lg" className="shadow-lg shadow-indigo-500/40 text-lg px-12 h-14">
                            Get Instant Access
                        </Button>
                    </Link>
                </div>
            </section>
        </div>
    );
}
