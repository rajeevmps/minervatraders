'use client';

import GlassCard from '../../components/ui/GlassCard';

export const FAQ = () => {
    return (
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
    );
};
