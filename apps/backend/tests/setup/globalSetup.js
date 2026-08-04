const { execFileSync } = require('child_process');
const path = require('path');

/**
 * Runs once before the whole suite: brings the test database's schema up to
 * date by applying the same migrations production uses.
 *
 * Tests therefore run against real Postgres with real constraints. The previous
 * suite mocked the database client, so it could not catch a broken query, a
 * violated constraint, or a bad migration — the failures that actually matter.
 */
module.exports = async () => {
    const databaseUrl =
        process.env.TEST_DATABASE_URL ||
        'postgresql://postgres:postgres@127.0.0.1:5433/minerva_test';

    const backendRoot = path.resolve(__dirname, '../..');

    // The package's `exports` map appends the extension, so the specifier must
    // NOT include `.js` — otherwise it resolves to `node-pg-migrate.js.js`.
    const migrateBin = require.resolve('node-pg-migrate/bin/node-pg-migrate');

    try {
        execFileSync(process.execPath, [migrateBin, 'up'], {
            cwd: backendRoot,
            env: { ...process.env, DATABASE_URL: databaseUrl },
            stdio: 'pipe',
        });
    } catch (error) {
        const detail = [error.stdout?.toString(), error.stderr?.toString(), error.message]
            .filter(Boolean)
            .join('\n');
        throw new Error(
            `Could not migrate the test database (${databaseUrl.replace(/:[^:@]+@/, ':***@')}).\n` +
                `Is Postgres running? Try: npm run db:start\n\n${detail}`
        );
    }
};
