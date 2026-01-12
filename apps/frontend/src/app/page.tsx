'use client';

import { HeroSection } from '../components/home/HeroSection';
import { FeaturesGrid } from '../components/home/FeaturesGrid';
import { SocialProof } from '../components/home/SocialProof';
import { FAQ } from '../components/home/FAQ';
import { CTASection } from '../components/home/CTASection';

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
            <HeroSection fadeIn={fadeIn} stagger={stagger} />
            <FeaturesGrid />
            <SocialProof />
            <FAQ />
            <CTASection />
        </div>
    );
}
