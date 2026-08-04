'use client';

import { useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';

/**
 * Restores the session once, on first mount.
 *
 * Because the access token lives in memory, a page load or hard refresh starts
 * with no token. This exchanges the httpOnly refresh cookie for a fresh one, so
 * a signed-in user stays signed in across reloads without any token ever
 * touching localStorage.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const initialise = useAuthStore((state) => state.initialise);

    useEffect(() => {
        void initialise();
    }, [initialise]);

    return <>{children}</>;
}

export default AuthProvider;
