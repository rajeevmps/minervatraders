import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
            <h2 className="text-4xl font-bold">404 - Not Found</h2>
            <p className="text-gray-400 text-lg">Could not find requested resource</p>
            <Link href="/" className="text-primary hover:underline">
                Return Home
            </Link>
        </div>
    );
}
