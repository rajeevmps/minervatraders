'use client';

import { useEffect, useRef } from 'react';
import type { TelegramLoginPayload } from '@repo/types';

/**
 * Telegram Login Widget.
 *
 * Telegram serves a script that injects its own button and calls a global
 * callback with a signed payload. The signature is verified server-side against
 * the bot token, so a forged payload cannot produce a session.
 *
 * This replaces Google OAuth: it costs nothing, proves identity
 * cryptographically, and yields the telegram_user_id the product needs anyway
 * to add and remove channel members.
 */

interface TelegramLoginButtonProps {
    onAuth: (payload: TelegramLoginPayload) => void;
    buttonSize?: 'large' | 'medium' | 'small';
    cornerRadius?: number;
    requestAccess?: boolean;
}

// Each mount gets its own global callback name so two widgets cannot collide.
let callbackCounter = 0;

export function TelegramLoginButton({
    onAuth,
    buttonSize = 'large',
    cornerRadius = 8,
    requestAccess = true,
}: TelegramLoginButtonProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    // Held in a ref so re-renders do not tear down and rebuild the widget.
    const onAuthRef = useRef(onAuth);
    onAuthRef.current = onAuth;

    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !botUsername) return;

        callbackCounter += 1;
        const callbackName = `onTelegramAuth_${callbackCounter}`;

        (window as unknown as Record<string, unknown>)[callbackName] = (
            payload: TelegramLoginPayload
        ) => onAuthRef.current(payload);

        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.async = true;
        script.setAttribute('data-telegram-login', botUsername);
        script.setAttribute('data-size', buttonSize);
        script.setAttribute('data-radius', String(cornerRadius));
        script.setAttribute('data-request-access', requestAccess ? 'write' : 'read');
        script.setAttribute('data-onauth', `${callbackName}(user)`);

        container.appendChild(script);

        return () => {
            container.innerHTML = '';
            delete (window as unknown as Record<string, unknown>)[callbackName];
        };
    }, [botUsername, buttonSize, cornerRadius, requestAccess]);

    if (!botUsername) {
        // A missing bot username is a real configuration gap, but it must not
        // leak an internal env var name to real visitors in production — that
        // reads as a broken site, not a diagnostic. Warn developers via the
        // console (visible in dev, invisible to end users either way) and only
        // render the on-page message outside production.
        if (typeof window !== 'undefined') {
            // eslint-disable-next-line no-console
            console.warn(
                'TelegramLoginButton: NEXT_PUBLIC_TELEGRAM_BOT_USERNAME is not set; the Telegram sign-in option is hidden.'
            );
        }

        if (process.env.NODE_ENV !== 'production') {
            return (
                <p className="text-xs text-amber-400/80">
                    Telegram sign-in hidden: set NEXT_PUBLIC_TELEGRAM_BOT_USERNAME to enable it.
                </p>
            );
        }

        return null;
    }

    return <div ref={containerRef} className="flex justify-center" />;
}

/**
 * Single source of truth for "is Telegram sign-in usable right now" — lets a
 * parent page skip rendering the "Or continue with" divider entirely rather
 * than showing it over an empty space when no bot is configured.
 */
export const isTelegramLoginConfigured = Boolean(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME);

export default TelegramLoginButton;
