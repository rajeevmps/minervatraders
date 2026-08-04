const request = require('supertest');
const app = require('../../src/app');
const tokenService = require('../../src/modules/auth/token.service');
const { createUser, createAdmin, DEFAULT_PASSWORD } = require('./factories');

/**
 * Auth helpers.
 *
 * signIn() goes through the real HTTP login route so tests exercise the actual
 * token pipeline. tokenFor() mints one directly, for tests that need a
 * particular claim shape without a round trip.
 */

const REFRESH_COOKIE = 'refresh_token';

/** Extract the refresh cookie from a supertest response. */
function refreshCookie(response) {
    const cookies = response.headers['set-cookie'] || [];
    const match = cookies.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
    return match ? match.split(';')[0] : null;
}

async function signIn({ email, password = DEFAULT_PASSWORD }) {
    const response = await request(app).post('/api/v1/auth/login').send({ email, password });

    if (response.status !== 200) {
        throw new Error(`signIn failed (${response.status}): ${JSON.stringify(response.body)}`);
    }

    return {
        user: response.body.data.user,
        accessToken: response.body.data.accessToken,
        refreshCookie: refreshCookie(response),
    };
}

/** Create a user and sign them in. */
async function createAndSignIn(overrides = {}) {
    const user = await createUser(overrides);
    const session = await signIn({ email: user.email, password: user.password });
    return { ...session, dbUser: user };
}

async function createAdminAndSignIn(overrides = {}) {
    const admin = await createAdmin(overrides);
    const session = await signIn({ email: admin.email, password: admin.password });
    return { ...session, dbUser: admin };
}

/** Mint an access token directly, bypassing login. */
const tokenFor = (user) =>
    tokenService.signAccessToken({ id: user.id, email: user.email, role: user.role });

/** `Authorization` header helper: .set(...authHeader(token)) */
const authHeader = (token) => ['Authorization', `Bearer ${token}`];

module.exports = {
    REFRESH_COOKIE,
    refreshCookie,
    signIn,
    createAndSignIn,
    createAdminAndSignIn,
    tokenFor,
    authHeader,
};
