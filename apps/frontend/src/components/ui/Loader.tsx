import { Loader2 } from 'lucide-react';

export default function Loader({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg', className?: string }) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-8 w-8',
        lg: 'h-12 w-12'
    };

    return (
        <div className={`flex items-center justify-center ${className}`}>
            <Loader2 className={`animate-spin text-blue-600 ${sizeClasses[size]}`} />
        </div>
    );
}
