'use client';

import { motion } from 'framer-motion';
import { Zap, Shield, TrendingUp, BarChart3, Users, Smartphone } from 'lucide-react';
import GlassCard from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import Link from 'next/link';

export default function FeaturesPage() {
    const features = [
        {
            icon: Zap,
            title: 'Real-Time Signals',
            description: 'Get instant notifications for high-probability trade setups. Our latency is minimal, ensuring you never miss a move.'
        },
        {
            icon: BarChart3,
            title: 'Deep Market Analysis',
            description: 'Weekly reports and daily pre-market analysis to keep you prepared for whatever the market throws at you.'
        },
        {
            icon: Shield,
            title: 'Risk Management',
            description: 'Every signal comes with predefined Stop Loss and Take Profit levels. We prioritize capital preservation.'
        },
        {
            icon: Users,
            title: 'Elite Community',
            description: 'Join a network of serious traders. Share charts, discuss strategies, and grow together.'
        },
        {
            icon: TrendingUp,
            title: 'Performance Tracking',
            description: 'Transparent monthly P&L reports. We believe in honesty and showing our real track record.'
        },
        {
            icon: Smartphone,
            title: 'Mobile First',
            description: 'Access everything from your phone. Our platform is optimized for trading on the go via Telegram.'
        }
    ];

    return (
        <div className="min-h-screen py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px]" />
            </div>

            <div className="max-w-7xl mx-auto">
                <div className="text-center max-w-3xl mx-auto mb-20">
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-6"
                    >
                        Features built for <span className="text-primary">Consistency</span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-xl text-gray-400"
                    >
                        Everything you need to take your trading to the institutional level.
                    </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 + 0.2 }}
                        >
                            <GlassCard className="h-full p-8" hoverEffect>
                                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                                    <feature.icon className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-4">{feature.title}</h3>
                                <p className="text-gray-400 leading-relaxed">{feature.description}</p>
                            </GlassCard>
                        </motion.div>
                    ))}
                </div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="mt-20 text-center"
                >
                    <Link href="/pricing">
                        <Button size="lg" className="shadow-lg shadow-primary/25">
                            Start Your Journey
                        </Button>
                    </Link>
                </motion.div>
            </div>
        </div>
    );
}
