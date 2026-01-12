'use client';

import { useEffect } from 'react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <html lang="en">
            <body>
                <div className="flex min-h-screen flex-col items-center justify-center text-center p-4 bg-black text-white">
                    <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
                    <p className="mb-8 text-gray-400">We apologize for the inconvenience.</p>
                    <button
                        onClick={() => reset()}
                        className="px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
                    >
                        Try again
                    </button>
                </div>
            </body>
        </html>
    );
}
