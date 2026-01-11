import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import '../styles/globals.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
    title: 'MinervaTraders - Premium Telegram Community',
    description: 'Join the world\'s most exclusive trading community.',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body className={`${inter.variable} font-sans bg-background text-foreground min-h-screen flex flex-col antialiased selection:bg-primary selection:text-white`}>
                <Navbar />
                <main className="flex-grow relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {children}
                </main>
                <Footer />
                <Toaster position="bottom-center" toastOptions={{
                    style: {
                        background: '#1E293B',
                        color: '#fff',
                        borderRadius: '1rem',
                        border: '1px solid rgba(255,255,255,0.1)',
                    }
                }} />
            </body>
        </html>
    );
}
