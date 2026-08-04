import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Edge route guard.
 *
 * There was no middleware at all before: protection was a `useEffect` in a
 * client layout that redirected only AFTER the protected page had mounted, and
 * several routes (/cart, /checkout, /subscriptions, /wishlist, /success) were
 * not guarded at all.
 *
 * IMPORTANT — what this is and is not:
 *
 * The real refresh token is httpOnly and scoped to the API's origin and path,
 * so middleware cannot read or verify it. This checks only a non-sensitive
 * marker cookie (see lib/session.ts) that carries no credential and grants no
 * access. It exists to route a signed-out visitor away from a protected page
 * without a flash of protected UI.
 *
 * It is NOT an authorisation boundary. Every real decision is made by the API
 * against a cryptographically verified access token, and admin status is
 * re-read from the database on each admin request. Forging this cookie gets an
 * attacker a page shell whose API calls all return 401/403.
 */

const SESSION_HINT_COOKIE = 'mv_session';

/** Require a session. */
const PROTECTED_PREFIXES = [
    '/dashboard',
    '/admin',
    '/cart',
    '/checkout',
    '/subscriptions',
    '/wishlist',
    '/success',
    '/orders',
    '/account',
];

/** Pointless to visit while already signed in. */
const AUTH_PAGES = ['/login', '/register'];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const hasSession = request.cookies.get(SESSION_HINT_COOKIE)?.value === '1';

    // The admin sign-in page must stay reachable to signed-out visitors.
    const isAdminLogin = pathname === '/admin/login';

    if (!hasSession && !isAdminLogin && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
        const target = pathname.startsWith('/admin') ? '/admin/login' : '/login';
        const url = request.nextUrl.clone();
        url.pathname = target;
        // Preserve the destination so sign-in can return the user to it.
        url.searchParams.set('next', pathname);
        return NextResponse.redirect(url);
    }

    if (hasSession && AUTH_PAGES.includes(pathname)) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        url.search = '';
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    // Skip Next internals, the API proxy and static assets.
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
