const db = require('../../src/config/db');
const settingsService = require('../../src/modules/settings/settings.service');

/**
 * System settings: whitelist enforcement and secret masking.
 */

describe('settings.service', () => {
    describe('updateSettings', () => {
        it('writes whitelisted keys', async () => {
            const result = await settingsService.updateSettings({
                SUPPORT_EMAIL: 'help@example.test',
                TELEGRAM_CHANNEL_ID: '-100999',
            });

            expect(result.updated).toEqual(
                expect.arrayContaining(['SUPPORT_EMAIL', 'TELEGRAM_CHANNEL_ID'])
            );
            expect(await db.scalar(`SELECT value FROM system_settings WHERE key = 'SUPPORT_EMAIL'`))
                .toBe('help@example.test');
        });

        it('silently ignores keys outside the whitelist', async () => {
            // The old implementation wrote every key in the body, so a request
            // could create unbounded arbitrary rows.
            const result = await settingsService.updateSettings({
                SUPPORT_EMAIL: 'help@example.test',
                EVIL_KEY: 'payload',
            });

            expect(result.rejected).toContain('EVIL_KEY');
            expect(await db.scalar(`SELECT count(*)::int FROM system_settings WHERE key = 'EVIL_KEY'`)).toBe(0);
        });

        it('upserts rather than duplicating on repeat writes', async () => {
            await settingsService.updateSettings({ SUPPORT_EMAIL: 'first@example.test' });
            await settingsService.updateSettings({ SUPPORT_EMAIL: 'second@example.test' });

            expect(await db.scalar(`SELECT count(*)::int FROM system_settings WHERE key = 'SUPPORT_EMAIL'`)).toBe(1);
            expect(await db.scalar(`SELECT value FROM system_settings WHERE key = 'SUPPORT_EMAIL'`))
                .toBe('second@example.test');
        });

        it('applies all keys atomically', async () => {
            await settingsService.updateSettings({
                SUPPORT_EMAIL: 'a@example.test',
                SUPPORT_TELEGRAM: '@support',
                SITE_ANNOUNCEMENT: 'Hello',
            });

            expect(await db.scalar(`SELECT count(*)::int FROM system_settings`)).toBe(3);
        });
    });

    describe('secret handling', () => {
        it('masks the bot token when reading settings back', async () => {
            await settingsService.updateSettings({ TELEGRAM_BOT_TOKEN: '123456:SUPERSECRETVALUE' });

            const settings = await settingsService.getSettings();

            expect(settings.TELEGRAM_BOT_TOKEN).not.toContain('SUPERSECRET');
            expect(settings.TELEGRAM_BOT_TOKEN).toMatch(/^•+ALUE$/);
        });

        it('does not overwrite the real secret when the masked value is sent back', async () => {
            await settingsService.updateSettings({ TELEGRAM_BOT_TOKEN: '123456:SUPERSECRETVALUE' });

            const masked = (await settingsService.getSettings()).TELEGRAM_BOT_TOKEN;
            // The admin UI renders the mask; saving the form must not persist it.
            await settingsService.updateSettings({ TELEGRAM_BOT_TOKEN: masked });

            const raw = await settingsService.getRawSettings(['TELEGRAM_BOT_TOKEN']);
            expect(raw.TELEGRAM_BOT_TOKEN).toBe('123456:SUPERSECRETVALUE');
        });

        it('getRawSettings returns unmasked values for internal use', async () => {
            await settingsService.updateSettings({ TELEGRAM_BOT_TOKEN: '123456:SUPERSECRETVALUE' });

            const raw = await settingsService.getRawSettings(['TELEGRAM_BOT_TOKEN']);
            expect(raw.TELEGRAM_BOT_TOKEN).toBe('123456:SUPERSECRETVALUE');
        });

        it('leaves non-secret values unmasked', async () => {
            await settingsService.updateSettings({ SUPPORT_EMAIL: 'help@example.test' });

            expect((await settingsService.getSettings()).SUPPORT_EMAIL).toBe('help@example.test');
        });
    });
});
