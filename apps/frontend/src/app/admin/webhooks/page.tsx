'use client';

import { useEffect, useState } from 'react';
import { adminService } from '../../../services/admin.service';
import { toast } from 'react-hot-toast';
import { Code, Trash2, Power, Plus } from 'lucide-react';

export default function WebhooksManagement() {
    const [webhooks, setWebhooks] = useState<Record<string, unknown>[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchWebhooks = async () => {
        setIsLoading(true);
        try {
            const result = await adminService.getWebhooks() as { webhooks: Record<string, unknown>[], totalCount: number };
            setWebhooks(result?.webhooks || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load webhook configurations');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchWebhooks();
    }, []);

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Webhook Inspector</h2>
                    <p className="text-slate-400">Monitor incoming event logs from payment gateways and external services.</p>
                </div>
                {/* For now, this is an inspector. Integrations feature can be added later if needed */}
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 text-slate-400 rounded-lg border border-slate-700/50 text-sm">
                    Incoming Logs
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    Array(3).fill(0).map((_, i) => (
                        <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 animate-pulse">
                            <div className="w-12 h-12 bg-slate-800 rounded-lg mb-4" />
                            <div className="h-4 bg-slate-800 rounded w-1/2 mb-2" />
                            <div className="h-3 bg-slate-800 rounded w-full" />
                        </div>
                    ))
                ) : webhooks.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
                        <Code className="w-12 h-12 mx-auto mb-4 opacity-10" />
                        <p>No webhook events recorded yet.</p>
                    </div>
                ) : webhooks.map((webhook, i) => (
                    <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 group hover:border-indigo-500/30 transition-all">
                        <div className="flex items-start justify-between mb-4">
                            <div className={`p-3 rounded-xl ${webhook.processed ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                                <Code className={`w-6 h-6 ${webhook.processed ? 'text-emerald-400' : 'text-amber-400'}`} />
                            </div>
                            <div className="flex gap-2">
                                <span className={`text-[10px] px-2 py-1 rounded-md font-mono border ${webhook.processed ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                    {webhook.processed ? 'PROCESSED' : 'PENDING'}
                                </span>
                            </div>
                        </div>
                        <h3 className="text-white font-bold mb-1 truncate">{webhook.event_type as string || 'Unknown Event'}</h3>
                        <p className="text-slate-500 text-xs font-mono mb-4">ID: {(webhook.id as string).substring(0, 13)}...</p>

                        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">
                                {new Date(webhook.created_at as string).toLocaleString()}
                            </span>
                            <button className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                                View Payload
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
