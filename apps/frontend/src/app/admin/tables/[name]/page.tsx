'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toast } from 'react-hot-toast';

export default function TableView() {
    const params = useParams();
    const tableName = params.name as string;
    const [data, setData] = useState<any[]>([]);
    const [count, setCount] = useState(0);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const limit = 20;

    // Supabase Client
    const supabase = createClientComponentClient();

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const from = (page - 1) * limit;
                const to = from + limit - 1;

                const { data: tableData, count: tableCount, error: tableError } = await supabase
                    .from(tableName)
                    .select('*', { count: 'exact' })
                    .range(from, to)
                    // We don't order by default to avoid errors if column doesn't exist
                    // Optionally we could check columns first, but raw dump is fine
                    .limit(limit);

                if (tableError) throw tableError;

                setData(tableData || []);
                setCount(tableCount || 0);
            } catch (err: any) {
                console.error(err);
                setError(err.message);
                toast.error(`Failed to load ${tableName}`);
            } finally {
                setIsLoading(false);
            }
        };

        if (tableName) {
            fetchData();
        }
    }, [tableName, page, supabase]);

    const totalPages = Math.ceil(count / limit);

    // Helper to format values
    const formatValue = (value: any) => {
        if (value === null || value === undefined) return <span className="text-slate-600">null</span>;
        if (typeof value === 'boolean') return value ? <span className="text-green-400">true</span> : <span className="text-red-400">false</span>;
        if (typeof value === 'object') return <span className="text-xs text-slate-500 truncate block max-w-[200px]">{JSON.stringify(value)}</span>;
        if (String(value).length > 50) return <span title={String(value)}>{String(value).substring(0, 50)}...</span>;
        return String(value);
    };

    if (isLoading && data.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Retrieving sector data...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-red-400 bg-red-500/5 rounded-2xl border border-red-500/10 p-8">
                <AlertCircle className="w-10 h-10 mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-1">Access Denied / Query Failed</h3>
                <p className="text-sm opacity-75">{error}</p>
                <Link href="/admin/dashboard" className="mt-4 text-primary hover:underline">
                    Return to System Overview
                </Link>
            </div>
        );
    }

    const columns = data.length > 0 ? Object.keys(data[0]) : [];

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link href="/admin/dashboard" className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-400" />
                    </Link>
                    <div>
                        <h2 className="text-2xl font-bold text-white capitalize">{tableName}</h2>
                        <p className="text-slate-400 text-sm mt-1">{count} records found</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center text-sm transition-colors">
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                    </button>
                </div>
            </header>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900 border-b border-slate-800">
                                {columns.map(col => (
                                    <th key={col} className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                                        {col}
                                    </th>
                                ))}
                                {columns.length === 0 && <th className="p-4"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {data.map((row, i) => (
                                <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                                    {columns.map(col => (
                                        <td key={col} className="p-4 text-sm text-slate-300 whitespace-nowrap">
                                            {formatValue(row[col])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            {data.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan={columns.length || 1} className="p-8 text-center text-slate-500">
                                        No logs found in this sector.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/30">
                    <div className="text-sm text-slate-500">
                        Page {page} of {totalPages || 1}
                    </div>
                    <div className="flex gap-2">
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage(p => p - 1)}
                            className="p-2 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="p-2 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
