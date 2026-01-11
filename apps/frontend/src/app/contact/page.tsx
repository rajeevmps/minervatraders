'use client';

import { motion } from 'framer-motion';
import { Mail, MessageSquare, MapPin } from 'lucide-react';
import GlassCard from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';

export default function ContactPage() {
    return (
        <div className="min-h-screen py-24 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">

                    {/* Info Side */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-8"
                    >
                        <div>
                            <h1 className="text-4xl font-bold text-white mb-4">Get in Touch</h1>
                            <p className="text-gray-400 text-lg">
                                Have questions about our premium plans? Need help with support? We're here for you.
                            </p>
                        </div>

                        <div className="space-y-6">
                            <GlassCard className="p-6 flex items-center gap-4 hover:bg-white/5 transition-colors cursor-pointer">
                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                    <Mail className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-white font-medium">Email Support</h3>
                                    <p className="text-sm text-gray-400">support@minervatraders.com</p>
                                </div>
                            </GlassCard>

                            <GlassCard className="p-6 flex items-center gap-4 hover:bg-white/5 transition-colors cursor-pointer">
                                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <MessageSquare className="w-5 h-5 text-green-500" />
                                </div>
                                <div>
                                    <h3 className="text-white font-medium">Telegram Support</h3>
                                    <p className="text-sm text-gray-400">@MinervaTradersSupport_Bot</p>
                                </div>
                            </GlassCard>

                            <GlassCard className="p-6 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                    <MapPin className="w-5 h-5 text-blue-500" />
                                </div>
                                <div>
                                    <h3 className="text-white font-medium">Office</h3>
                                    <p className="text-sm text-gray-400">Bangalore, India</p>
                                </div>
                            </GlassCard>
                        </div>
                    </motion.div>

                    {/* Form Side */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <GlassCard className="p-8">
                            <form className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-300">First Name</label>
                                        <input type="text" className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all" placeholder="John" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-300">Last Name</label>
                                        <input type="text" className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all" placeholder="Doe" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Email</label>
                                    <input type="email" className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all" placeholder="john@example.com" />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Message</label>
                                    <textarea rows={4} className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all" placeholder="How can we help?" />
                                </div>

                                <Button className="w-full shadow-glow" size="lg">Send Message</Button>
                            </form>
                        </GlassCard>
                    </motion.div>

                </div>
            </div>
        </div>
    );
}
