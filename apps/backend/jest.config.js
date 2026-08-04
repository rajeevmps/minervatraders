module.exports = {
    testEnvironment: 'node',
    verbose: true,

    // Order matters: env.js assigns process.env before any module loads;
    // setup.js then runs after the test framework is installed.
    setupFiles: ['<rootDir>/tests/setup/env.js'],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    globalSetup: '<rootDir>/tests/setup/globalSetup.js',

    testMatch: ['**/tests/**/*.test.js'],

    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text-summary', 'lcov'],
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/server.js', // process bootstrap; exercised by running the app
    ],
    coveragePathIgnorePatterns: ['/node_modules/', '/tests/', '/migrations/'],

    /**
     * A gate, not decoration. Coverage was collected before but nothing
     * enforced it, so it could silently fall to zero. Start at a level the
     * suite genuinely clears and ratchet upward.
     */
    coverageThreshold: {
        // Set just below current levels: high enough that a regression fails
        // the build, with a little slack so an unrelated refactor does not.
        global: {
            statements: 70,
            branches: 60,
            functions: 70,
            lines: 70,
        },
        // Security-critical paths are held to a higher bar.
        './src/modules/auth/': {
            statements: 92,
            branches: 80,
            functions: 95,
            lines: 92,
        },
        './src/middlewares/': {
            statements: 78,
            branches: 62,
            functions: 85,
            lines: 78,
        },
    },

    // Suites share one Postgres database and truncate between tests, so they
    // must not run concurrently. `npm test` also passes --runInBand.
    maxWorkers: 1,
};
