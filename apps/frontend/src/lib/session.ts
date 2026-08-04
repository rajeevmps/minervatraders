/**
 * Access-token storage.
 *
 * The token lives in a module variable — deliberately NOT in localStorage.
 * Anything in localStorage is readable by any script on the page, so an XSS bug
 * would leak a usable token; a module variable dies with the tab.
 *
 * Durability comes from the refresh-token cookie instead: it is httpOnly, so
 * JavaScript cannot read it, and `bootstrapSession()` exchanges it for a fresh
 * access token on page load.
 *
 * This also fixes a concrete bug in the previous implementation, where several
 * call sites read a token persisted in the Zustand store that was never
 * refreshed, so requests began failing 15 minutes after sign-in.
 */

let accessToken: string | null = null;

/** Notified whenever the token changes, so the UI can react to sign-out. */
type Listener = (token: string | null) => void;
const listeners = new Set<Listener>();

export const getAccessToken = () => accessToken;

export function setAccessToken(token: string | null) {
    accessToken = token;
    setSessionHint(Boolean(token));
    listeners.forEach((listener) => listener(token));
}

export const clearAccessToken = () => setAccessToken(null);

export function onTokenChange(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/**
 * A non-sensitive marker cookie readable by Next.js middleware.
 *
 * The real refresh cookie is httpOnly and scoped to the API's origin and path,
 * so middleware cannot see it. This hint carries NO token and grants NO access
 * — it exists purely so the edge can redirect a signed-out visitor away from
 * /dashboard without a flash of protected UI. Every actual authorisation
 * decision is still made by the API against a verified token.
 */
export const SESSION_HINT_COOKIE = 'mv_session';

function setSessionHint(present: boolean) {
    if (typeof document === 'undefined') return;

    if (present) {
        const maxAge = 30 * 24 * 60 * 60; // matches REFRESH_TOKEN_TTL_DAYS
        document.cookie = `${SESSION_HINT_COOKIE}=1; path=/; max-age=${maxAge}; SameSite=Lax`;
    } else {
        document.cookie = `${SESSION_HINT_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
    }
}
