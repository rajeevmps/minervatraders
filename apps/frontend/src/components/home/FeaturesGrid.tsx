'use client';

import { Zap, Shield, TrendingUp } from 'lucide-react';
import GlassCard from '../../components/ui/GlassCard';

export const FeaturesGrid = () => {
    return (
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
    );
};
