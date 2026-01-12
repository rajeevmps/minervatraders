'use client';

export const SocialProof = () => {
    return (
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
    );
};
