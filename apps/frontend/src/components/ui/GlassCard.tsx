'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface GlassCardProps {
    children: ReactNode;
    className?: string;
    hoverEffect?: boolean;
}

export default function GlassCard({ children, className = '', hoverEffect = false }: GlassCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={hoverEffect ? { y: -5, boxShadow: '0 20px 40px -15px rgba(99, 102, 241, 0.3)' } : {}}
            transition={{ duration: 0.3 }}
            className={`
                relative overflow-hidden
                backdrop-blur-xl bg-surface/50 border border-white/10
                rounded-2xl shadow-glass
                ${className}
            `}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
            <div className="relative z-10 h-full">
                {children}
            </div>
        </motion.div>
    );
}
