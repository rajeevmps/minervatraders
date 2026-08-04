const jwt = require('jsonwebtoken');
const db = require('../../src/config/db');
const tokenService = require('../../src/modules/auth/token.service');
const { createUser } = require('../helpers/factories');

/**
 * Refresh-token lifecycle.
 *
 * The reuse-detection test here covers a bug found during the migration: the
 * revocation used to run inside the same transaction as the throw, so ROLLBACK
 * silently undid it and a stolen token family survived.
 */

describe('token.service', () => {
    describe('access tokens', () => {
        it('signs a token carrying sub, email and role', async () => {
            const user = await createUser({ role: 'admin' });
            const decoded = jwt.decode(tokenService.signAccessToken(user));

            expect(decoded).toMatchObject({ sub: user.id, email: user.email, role: 'admin' });
        });

        it('verifies its own tokens', async () => {
            const user = await createUser();
            const decoded = tokenService.verifyAccessToken(tokenService.signAccessToken(user));

            expect(decoded.sub).toBe(user.id);
        });

        it('rejects a token signed with a different secret', async () => {
            const user = await createUser();
            const forged = jwt.sign({ sub: user.id, role: 'admin' }, 'wrong-secret', {
                issuer: 'minerva-api',
            });

            expect(() => tokenService.verifyAccessToken(forged)).toThrow();
        });

        it('rejects a token with the wrong issuer', async () => {
            const user = await createUser();
            const wrongIssuer = jwt.sign(
                { sub: user.id },
                process.env.JWT_ACCESS_SECRET,
                { issuer: 'somebody-else' }
            );

            expect(() => tokenService.verifyAccessToken(wrongIssuer)).toThrow();
        });

        it('rejects an expired token', async () => {
            const user = await createUser();
            const expired = jwt.sign(
                { sub: user.id },
                process.env.JWT_ACCESS_SECRET,
                { issuer: 'minerva-api', expiresIn: '-1s' }
            );

            expect(() => tokenService.verifyAccessToken(expired)).toThrow(/expired/i);
        });
    });

    describe('refresh tokens', () => {
        it('stores only a hash, never the token itself', async () => {
            const user = await createUser();
            const { token } = await tokenService.issueRefreshToken({ userId: user.id });

            const stored = await db.one(`SELECT token_hash FROM refresh_tokens WHERE user_id = $1`, [
                user.id,
            ]);

            expect(stored.token_hash).not.toBe(token);
            expect(stored.token_hash).toMatch(/^[a-f0-9]{64}$/);
        });

        it('rotates: the old token is revoked and linked to its replacement', async () => {
            const user = await createUser();
            const first = await tokenService.issueRefreshToken({ userId: user.id });

            const rotated = await tokenService.rotateRefreshToken({ token: first.token });

            expect(rotated.refreshToken).not.toBe(first.token);

            const old = await db.one(`SELECT revoked_at, replaced_by FROM refresh_tokens WHERE id = $1`, [
                first.id,
            ]);
            expect(old.revoked_at).not.toBeNull();
            expect(old.replaced_by).not.toBeNull();
        });

        it('rejects an unrecognised token', async () => {
            await expect(
                tokenService.rotateRefreshToken({ token: 'never-issued' })
            ).rejects.toMatchObject({ code: 'REFRESH_INVALID' });
        });

        it('rejects an expired token', async () => {
            const user = await createUser();
            const { token, id } = await tokenService.issueRefreshToken({ userId: user.id });
            await db.query(`UPDATE refresh_tokens SET expires_at = now() - interval '1 day' WHERE id = $1`, [id]);

            await expect(tokenService.rotateRefreshToken({ token })).rejects.toMatchObject({
                code: 'REFRESH_EXPIRED',
            });
        });

        it('detects reuse and PERSISTS revocation of the whole family', async () => {
            const user = await createUser();
            const first = await tokenService.issueRefreshToken({ userId: user.id });

            // Legitimate rotation.
            const second = await tokenService.rotateRefreshToken({ token: first.token });

            // Attacker replays the already-rotated token.
            await expect(
                tokenService.rotateRefreshToken({ token: first.token })
            ).rejects.toMatchObject({ code: 'REFRESH_REUSED' });

            // The revocation must survive — it previously rolled back with the
            // transaction that threw, leaving the stolen family usable.
            const live = await db.scalar(
                `SELECT count(*)::int FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL`,
                [user.id]
            );
            expect(live).toBe(0);

            // And the legitimate client's newest token is dead too.
            await expect(
                tokenService.rotateRefreshToken({ token: second.refreshToken })
            ).rejects.toMatchObject({ code: 'REFRESH_REUSED' });
        });

        it('refuses to rotate for a deactivated account', async () => {
            const user = await createUser();
            const { token } = await tokenService.issueRefreshToken({ userId: user.id });
            await db.query(`UPDATE users SET is_active = FALSE WHERE id = $1`, [user.id]);

            await expect(tokenService.rotateRefreshToken({ token })).rejects.toMatchObject({
                code: 'ACCOUNT_INACTIVE',
            });
        });

        it('revokeRefreshToken makes a token unusable', async () => {
            const user = await createUser();
            const { token } = await tokenService.issueRefreshToken({ userId: user.id });

            await tokenService.revokeRefreshToken(token);

            await expect(tokenService.rotateRefreshToken({ token })).rejects.toMatchObject({
                code: 'REFRESH_REUSED',
            });
        });

        it('revokeAllForUser clears every live session', async () => {
            const user = await createUser();
            await tokenService.issueRefreshToken({ userId: user.id });
            await tokenService.issueRefreshToken({ userId: user.id });

            await tokenService.revokeAllForUser(user.id);

            const live = await db.scalar(
                `SELECT count(*)::int FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL`,
                [user.id]
            );
            expect(live).toBe(0);
        });

        it('purgeExpired removes only long-dead rows', async () => {
            const user = await createUser();
            const recent = await tokenService.issueRefreshToken({ userId: user.id });
            const ancient = await tokenService.issueRefreshToken({ userId: user.id });

            await db.query(
                `UPDATE refresh_tokens SET expires_at = now() - interval '60 days' WHERE id = $1`,
                [ancient.id]
            );

            const purged = await tokenService.purgeExpired();

            expect(purged).toBe(1);
            expect(await db.one(`SELECT id FROM refresh_tokens WHERE id = $1`, [recent.id])).not.toBeNull();
        });
    });
});
