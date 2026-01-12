'use client';

import { Check, Star } from 'lucide-react';
import { Button } from './ui/Button';
import GlassCard from './ui/GlassCard';

interface PricingCardProps {
    planName: string;
    price: string;
    duration: string;
    features: string[];
    isPopular?: boolean;
    onSelect: () => void;
    isLoading?: boolean;
}

export default function PricingCard({
    planName,
    price,
    duration,
    features,
    isPopular,
    onSelect,
    isLoading
}: PricingCardProps) {
    return (
        <div className="relative h-full">
            {isPopular && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20">
                    <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-black text-xs font-bold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 fill-black" />
                        MOST POPULAR
                    </div>
                </div>
            )}

            <GlassCard
                className={`h-full p-8 ${isPopular ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20' : ''}`}
                hoverEffect
            >
                <div className="flex flex-col h-full">
                    <div className="mb-8 p-0">
                        <h3 className={`text-xl font-semibold mb-2 ${isPopular ? 'text-primary' : 'text-gray-100'}`}>{planName}</h3>
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-bold text-white">₹{price}</span>
                            <span className="text-gray-400">/{duration}</span>
                        </div>
                    </div>

                    <ul className="space-y-4 mb-8 flex-1">
                        {features.map((feature) => (
                            <li key={feature} className="flex items-start gap-3">
                                <div className="mt-1 rounded-full bg-green-500/10 p-1">
                                    <Check className="w-3.5 h-3.5 text-green-500" />
                                </div>
                                <span className="text-sm text-gray-300 leading-relaxed">{feature}</span>
                            </li>
                        ))}
                    </ul>

                    <Button
                        onClick={onSelect}
                        isLoading={isLoading}
                        variant={isPopular ? 'primary' : 'outline'}
                        className={`w-full ${isPopular ? 'shadow-glow bg-primary hover:bg-primary/90' : 'hover:border-primary/50'}`}
                        size="lg"
                    >
                        Choose {planName}
                    </Button>
                </div>
            </GlassCard>
        </div>
    );
}
