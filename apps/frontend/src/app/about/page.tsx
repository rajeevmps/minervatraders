'use client';

import { motion } from 'framer-motion';
import GlassCard from '../../components/ui/GlassCard';

export default function AboutPage() {
    return (
        <div className="min-h-screen py-24 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto space-y-16">

                {/* Hero */}
                <div className="text-center">
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl md:text-5xl font-bold text-white mb-6"
                    >
                        About <span className="text-primary">MinervaTraders</span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-xl text-gray-400"
                    >
                        Democratizing access to institutional-grade market intelligence.
                    </motion.p>
                </div>

                {/* Mission */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <GlassCard className="p-10">
                        <h2 className="text-2xl font-bold text-white mb-6">Our Mission</h2>
                        <div className="text-gray-300 space-y-4 leading-relaxed">
                            <p>
                                We noticed a gap in the market: retail traders often rely on outdated information or &quot;guru&quot; signals that lack transparency. MinervaTraders was born to change that.
                            </p>
                            <p>
                                Our mission is to provide clear, actionable, and data-driven market insights directly to your phone. We combine advanced algorithm analysis with expert human oversight to filter out the noise and deliver high-quality setups.
                            </p>
                        </div>
                    </GlassCard>
                </motion.div>

                {/* Stats / Trust */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                        className="p-6"
                    >
                        <h3 className="text-4xl font-bold text-primary mb-2">5K+</h3>
                        <p className="text-sm text-gray-500 uppercase tracking-wider">Active Members</p>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 }}
                        className="p-6"
                    >
                        <h3 className="text-4xl font-bold text-primary mb-2">89%</h3>
                        <p className="text-sm text-gray-500 uppercase tracking-wider">Success Rate</p>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5 }}
                        className="p-6"
                    >
                        <h3 className="text-4xl font-bold text-primary mb-2">24/7</h3>
                        <p className="text-sm text-gray-500 uppercase tracking-wider">Support</p>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
