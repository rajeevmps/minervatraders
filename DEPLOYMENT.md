# Running Locally

This project currently runs **locally only** — there is no configured production
deployment target. Everything below runs on your own machine with no paid
third-party services except Razorpay, which only charges per successful
transaction.

If you decide to deploy later, see [Going to production](#going-to-production)
at the end of this file for what changes.

---

## What's running, and where

| Component | How | Port |
| --- | --- | --- |
| PostgreSQL 17 | Portable binaries in `.postgres/` (project-local, no install) | `5433` |
| Backend (Express) | `node src/server.js` | `5000` |
| Frontend (Next.js) | `next dev` | `3000` |

Nothing is containerized. `docker-compose.yml` and `infra/` predate this setup
and are stale — ignore them until a real deployment target is chosen.

---

## First-time setup

```powershell
# 1. Install dependencies (root, workspaces)
npm install

# 2. Initialize the local Postgres cluster (creates .postgres/, starts the
#    server, creates minerva_dev and minerva_test databases)
npm run db:init

# 3. Copy env templates and fill in secrets
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env.local
```

Generate the two JWT secrets `apps/backend/.env` needs:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Run it twice — `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must be **different**
values, each at least 32 characters. Everything else in `.env.example` has a
usable local default or is optional outside production (see the file for
which).

```powershell
# 4. Apply the schema
npm run migrate:up

# 5. Seed subscription plans + an admin account
npm run seed
```

The seed step prints the admin email/password it used. Set
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` env vars before running it if you
want specific credentials instead of the default.

---

## Running

```powershell
npm run db:start   # if the Postgres cluster isn't already running
npm run dev        # starts backend (5000) and frontend (3000) together
```

- Frontend: http://localhost:3000
- Backend health: http://localhost:5000/health
- Backend readiness (checks the database): http://localhost:5000/ready
- Admin portal: http://localhost:3000/admin/login

```powershell
npm run db:stop     # stop Postgres when you're done
npm run db:status    # check whether it's running
npm run db:psql      # open a psql shell on minerva_dev
npm run db:reset      # drop and recreate both databases (destructive — asks nothing, just does it)
```

---

## Running the test suite

Tests run against `minerva_test`, a separate database that gets truncated
between test files — it is never the same database as `minerva_dev`.

```powershell
npm run db:start    # Postgres must be running
npm test            # migrates minerva_test automatically, then runs Jest
```

Coverage thresholds are enforced (`apps/backend/jest.config.js`) — a coverage
regression fails the build, same as it will in CI.

---

## What each service needs to actually work

The app boots and serves pages with nothing but Postgres configured. These are
optional until you need the feature that depends on them:

| Feature | Requires |
| --- | --- |
| Payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| Telegram invites, bot commands | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`, `TELEGRAM_WEBHOOK_SECRET` |
| Telegram Login (sign-in button) | `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` (frontend) |

All three are validated as **required** when `NODE_ENV=production` and
**optional** otherwise — the backend fails fast on boot in production if
they're missing, but a local dev environment starts fine without them.

To exercise Telegram locally, the bot needs a public URL for its webhook — use
`ngrok http 5000` (or similar) and register
`https://<your-tunnel>/api/v1/telegram/webhook` with
`https://api.telegram.org/bot<TOKEN>/setWebhook`, passing your
`TELEGRAM_WEBHOOK_SECRET` as `secret_token`.

---

## Troubleshooting

**`npm run migrate:up` fails with a connection error.**
Postgres isn't running — `npm run db:start`, then check `npm run db:status`.

**Backend refuses to boot with "Environment validation failed".**
It's printing exactly which variable is missing or malformed — check
`apps/backend/.env` against `apps/backend/.env.example`. A blank value
(`FOO=`) is treated as absent, not as an empty string.

**Frontend can't reach the backend.**
Confirm `NEXT_PUBLIC_API_URL` in `apps/frontend/.env.local` matches where the
backend is actually listening (`http://localhost:5000/api/v1` by default).

**Tests fail with a migration error.**
`minerva_test` is out of sync — `npm run db:reset` recreates both databases
cleanly, then re-run `npm test`.

---

## Going to production

Nothing about the code assumes local-only operation — there's no dev-only
shortcut baked in. What changes for a real deployment:

1. **Postgres** — the portable local cluster is for development. Point
   `DATABASE_URL` at a real Postgres instance (self-hosted VPS, or a managed
   provider if you're OK with that cost/dependency) and run
   `npm run migrate:up` against it once.
2. **Secrets** — generate fresh `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
   values for production; never reuse the ones from a local `.env`.
3. **`NODE_ENV=production`** — this flips Razorpay/Telegram env vars to
   required, tightens cookie `secure` flags, and removes the permissive
   CORS/ngrok allowances in `apps/backend/src/app.js`.
4. **Hosting** — `apps/backend/Dockerfile` and `apps/frontend/Dockerfile`
   exist and build correctly; `docker-compose.yml` and `infra/nginx/` are a
   starting point but haven't been exercised as part of this local-only setup
   and should be reviewed before relying on them.
5. **CI/CD** — `.github/workflows/ci.yml` runs lint, type-check, and the full
   test suite against a real Postgres service container. The build-and-push
   job tags images with the commit SHA in addition to `latest`, but there is
   no deploy step wired up yet — that's the next thing to add once a hosting
   target is chosen.

This file will get a real "Part 2: Deploy" section once that decision is made.
