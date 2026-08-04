#!/usr/bin/env node
/**
 * Control script for the project-local portable Postgres cluster.
 *
 * The cluster lives entirely inside the repo (.postgres/) and is never installed
 * into the OS: no service, no registry entries, no admin rights. Deleting
 * .postgres/ removes every trace of it.
 *
 *   node scripts/db.js init     create the cluster + dev/test databases
 *   node scripts/db.js start    start the server
 *   node scripts/db.js stop     stop the server
 *   node scripts/db.js status   report whether it is running
 *   node scripts/db.js psql     open an interactive shell on minerva_dev
 *   node scripts/db.js reset    drop and recreate both databases
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PG_HOME = path.join(ROOT, '.postgres');
const BIN = path.join(PG_HOME, 'bin');
const DATA = path.join(PG_HOME, 'data');
const LOG = path.join(PG_HOME, 'server.log');

const PORT = process.env.PGPORT_LOCAL || '5433';
const SUPERUSER = 'postgres';
const PASSWORD = 'postgres'; // local-only cluster bound to loopback
const DATABASES = ['minerva_dev', 'minerva_test'];

const exe = (name) => path.join(BIN, process.platform === 'win32' ? `${name}.exe` : name);

function run(bin, args, opts = {}) {
    const res = spawnSync(bin, args, {
        stdio: opts.capture ? 'pipe' : 'inherit',
        encoding: 'utf8',
        // Password for non-interactive client connections; ignored by server-side tools.
        env: { ...process.env, PGPASSWORD: PASSWORD },
        ...opts,
    });
    if (res.error) throw res.error;
    return res;
}

function assertInstalled() {
    if (!fs.existsSync(exe('pg_ctl'))) {
        console.error(
            `Postgres binaries not found at ${BIN}\n` +
                `Run the setup step that populates .postgres/ before using this script.`
        );
        process.exit(1);
    }
}

function isRunning() {
    const res = run(exe('pg_ctl'), ['-D', DATA, 'status'], { capture: true });
    return res.status === 0;
}

function init() {
    if (fs.existsSync(path.join(DATA, 'PG_VERSION'))) {
        console.log('Cluster already initialised; skipping initdb.');
    } else {
        // initdb reads the superuser password from a file so it never appears in argv.
        const pwFile = path.join(os.tmpdir(), `pgpw-${process.pid}`);
        fs.writeFileSync(pwFile, PASSWORD, { mode: 0o600 });
        try {
            const res = run(exe('initdb'), [
                '-D', DATA,
                '-U', SUPERUSER,
                '--auth-local=scram-sha-256',
                '--auth-host=scram-sha-256',
                `--pwfile=${pwFile}`,
                '-E', 'UTF8',
                '--locale=C',
            ]);
            if (res.status !== 0) process.exit(res.status ?? 1);
        } finally {
            fs.rmSync(pwFile, { force: true });
        }
    }

    if (!isRunning()) start();
    for (const db of DATABASES) createDatabase(db);
    console.log(`\nReady. DATABASE_URL=postgresql://${SUPERUSER}:${PASSWORD}@127.0.0.1:${PORT}/minerva_dev`);
}

function createDatabase(name) {
    const check = run(
        exe('psql'),
        ['-h', '127.0.0.1', '-p', PORT, '-U', SUPERUSER, '-d', 'postgres', '-tAc',
         `SELECT 1 FROM pg_database WHERE datname='${name}'`],
        { capture: true }
    );
    if (check.stdout && check.stdout.trim() === '1') {
        console.log(`Database ${name} already exists.`);
        return;
    }
    const res = run(exe('createdb'), ['-h', '127.0.0.1', '-p', PORT, '-U', SUPERUSER, name]);
    if (res.status !== 0) process.exit(res.status ?? 1);
    console.log(`Created database ${name}.`);
}

function start() {
    if (isRunning()) {
        console.log(`Already running on port ${PORT}.`);
        return;
    }
    // -h 127.0.0.1 binds loopback only; this cluster must never accept remote traffic.
    const res = run(exe('pg_ctl'), [
        '-D', DATA,
        '-l', LOG,
        '-o', `-p ${PORT} -h 127.0.0.1`,
        '-w',
        'start',
    ]);
    if (res.status !== 0) {
        console.error(`Failed to start. Check ${LOG}`);
        process.exit(res.status ?? 1);
    }
    console.log(`Postgres running on 127.0.0.1:${PORT}`);
}

function stop() {
    if (!isRunning()) {
        console.log('Not running.');
        return;
    }
    run(exe('pg_ctl'), ['-D', DATA, '-m', 'fast', '-w', 'stop']);
}

function status() {
    console.log(isRunning() ? `Running on 127.0.0.1:${PORT}` : 'Stopped');
}

function psql(db = 'minerva_dev') {
    run(exe('psql'), ['-h', '127.0.0.1', '-p', PORT, '-U', SUPERUSER, '-d', db]);
}

function reset() {
    if (!isRunning()) start();
    for (const db of DATABASES) {
        run(exe('dropdb'), ['-h', '127.0.0.1', '-p', PORT, '-U', SUPERUSER, '--if-exists', '-f', db]);
        createDatabase(db);
    }
    console.log('Databases reset. Run migrations next.');
}

const commands = { init, start, stop, status, psql, reset };
const cmd = process.argv[2];

assertInstalled();

if (!cmd || !commands[cmd]) {
    console.error(`Usage: node scripts/db.js <${Object.keys(commands).join('|')}>`);
    process.exit(1);
}

commands[cmd](...process.argv.slice(3));
