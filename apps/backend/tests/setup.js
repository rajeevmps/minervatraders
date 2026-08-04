const { truncateAll, closeDb } = require('./helpers/db');

/**
 * Per-suite lifecycle (jest `setupFilesAfterEnv`).
 *
 * Truncating BEFORE each test rather than after means a failed test leaves its
 * data in place for inspection, while the next test still starts clean.
 *
 * Environment variables are set in tests/setup/env.js, which runs earlier —
 * they must be in place before config/env.js is imported and validated.
 */

jest.setTimeout(20_000);

beforeEach(async () => {
    await truncateAll();
});

afterAll(async () => {
    // Without this the pg pool keeps the event loop alive and Jest warns about
    // open handles, or hangs on exit.
    await closeDb();
});
