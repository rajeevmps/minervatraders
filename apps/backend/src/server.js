const app = require('./app');
const db = require('./config/db');
const cronService = require('./modules/cron/cron.service');
const logger = require('./utils/logger');
const { port, nodeEnv } = require('./config/env');

/**
 * Process entry point.
 *
 * Startup is now sequenced: the database is verified BEFORE the port is bound,
 * so an instance never accepts traffic it cannot serve. Cron registration also
 * moved here from app.js module scope, where it used to start during test runs.
 */

let server;

async function start() {
    await db.connectDB();

    cronService.initCronJobs();

    server = app.listen(port, () => {
        logger.info(`Server listening on port ${port}`, { env: nodeEnv });
    });
}

/** Drain in-flight requests before exiting so deploys do not drop connections. */
async function shutdown(signal) {
    logger.info(`${signal} received, shutting down`);

    cronService.stopCronJobs();

    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
    await db.close();

    logger.info('Shutdown complete');
    process.exit(0);
}

['SIGTERM', 'SIGINT'].forEach((signal) => {
    process.on(signal, () => {
        shutdown(signal).catch((error) => {
            logger.error('Shutdown failed', { error: error.message });
            process.exit(1);
        });
    });
});

// Without these a rejected promise or thrown error in a callback would either
// terminate the process silently or leave it running in a broken state.
process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', {
        error: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
    });
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception — exiting', { error: error.message, stack: error.stack });
    process.exit(1);
});

start().catch((error) => {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
});
