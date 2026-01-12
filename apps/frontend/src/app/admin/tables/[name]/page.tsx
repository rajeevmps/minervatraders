'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { adminService } from '../../../../services/admin.service';
import { Loader2, ArrowLeft, RefreshCcw, Search, Filter } from 'lucide-react';
import Link from 'next/link';

export default function TableView() {
    const params = useParams();
    const tableName = params.name as string;
    const [data, setData] = useState<Record<string, unknown>[]>([]);
    const [count, setCount] = useState(0);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const result = await adminService.getTableData(tableName, page);
                setData(result.data || []);
                setCount(result.count || 0);
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [tableName, page]);

    const formatValue = (val: unknown) => {
        if (val === null || val === undefined) return '-';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    };

    const columns = data.length > 0 ? Object.keys(data[0] as Record<string, unknown>) : [];

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/admin/tables"
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h2 className="text-2xl font-bold text-white capitalize">{tableName}</h2>
                        <p className="text-slate-400 text-sm">Direct database table explorer</p>
                    </div>
                </div>
                <button
                    onClick={() => setPage(1)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                    <RefreshCcw
                        className={`w-4 h-4 ${isLoading ? 'animate-spin text-primary' : ''}`}
                    />
                    Refresh
                </button>
            </header>

            {/* Controls */}
            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Filter rows..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-primary/50 outline-none"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-400">Total: {count} rows</span>
                </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-950/50 border-b border-slate-800">
                            <tr>
                                {columns.map((col) => (
                                    <th
                                        key={col}
                                        className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider"
                                    >
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {isLoading && data.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={columns.length || 1}
                                        className="px-6 py-12 text-center text-slate-500"
                                    >
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 opacity-20" />
                                        Fetching data...
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={columns.length || 1}
                                        className="px-6 py-12 text-center text-slate-500 italic"
                                    >
                                        No records found
                                    </td>
                                </tr>
                            ) : (
                                data.map((row, i) => (
                                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                        {columns.map((col) => (
                                            <td
                                                key={col}
                                                className="px-6 py-4 text-sm text-slate-300 font-mono whitespace-nowrap overflow-hidden max-w-[300px] truncate"
                                            >
                                                {formatValue(row[col])}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination placeholder */}
            <div className="flex justify-center">
                <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="px-4 py-2 hover:bg-slate-800 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                        Previous
                    </button>
                    <div className="px-4 py-2 text-slate-400 border-x border-slate-800">
                        Page {page}
                    </div>
                    <button
                        disabled={page * 50 >= count}
                        onClick={() => setPage((p) => p + 1)}
                        className="px-4 py-2 hover:bg-slate-800 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}
