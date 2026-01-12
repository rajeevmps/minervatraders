'use client';

import Link from 'next/link';
import { Button } from '../../components/ui/Button';

export const CTASection = () => {
    return (
        <section className="w-full max-w-5xl mx-auto px-4 text-center">
            <div className="relative overflow-hidden rounded-3xl bg-primary/10 border border-primary/20 p-12 md:p-20 space-y-8">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />

                <h2 className="text-4xl md:text-5xl font-bold">Ready to level up?</h2>
                <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                    Don&apos;t miss the next big move. Join our community today and start trading with confidence.
                </p>
                <Link href="/register" className="inline-block">
                    <Button size="lg" className="shadow-lg shadow-indigo-500/40 text-lg px-12 h-14">
                        Get Instant Access
                    </Button>
                </Link>
            </div>
        </section>
    );
};
