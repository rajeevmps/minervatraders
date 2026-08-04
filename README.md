# MinervaTraders — Premium Telegram Subscription Platform

A full-stack platform for selling paid access to a Telegram channel:
subscription plans, Razorpay checkout, automated invite generation on payment,
and automated removal on expiry.

Runs entirely self-hosted — no Supabase, no Google OAuth, no paid third party
except Razorpay (which only charges per successful transaction). See
[DEPLOYMENT.md](./DEPLOYMENT.md) for how to run it.

## Features

- **Automated membership management** — payment grants a channel invite;
  expiry triggers automatic removal via a Postgres-advisory-locked cron job.
- **Self-hosted authentication** — email + password (bcrypt) or the free
  [Telegram Login Widget](https://core.telegram.org/widgets/login), which also
  supplies the Telegram user id the product needs to manage channel membership.
  Access tokens are short-lived JWTs; refresh tokens are rotating, revocable,
  and stored as httpOnly cookies.
- **Admin portal** — user management, subscription grants/revokes, audit log,
  a generic (whitelisted) table browser, CSV export.
- **Razorpay integration** — checkout and webhook fulfilment share one
  idempotent activation path, so a race between the two cannot double-activate
  a subscription.
- **Role-based access control** — admin status is re-read from the database on
  every admin request, so revoking it takes effect immediately rather than
  waiting out the access token's lifetime.
- **Zod validation** on every route that accepts user input.

## Tech Stack

### Frontend (`apps/frontend`)
- Next.js 14 (App Router), TypeScript
- Tailwind CSS, Framer Motion
- Zustand (session state — the access token itself lives in memory, not the
  store, and is never persisted to localStorage)
- Axios, with a shared interceptor that transparently refreshes an expired
  access token

### Backend (`apps/backend`)
- Node.js, Express
- PostgreSQL via the `pg` driver directly — no ORM, no query builder
- `node-pg-migrate` for schema migrations
- Zod for request validation
- Razorpay SDK
- `node-cron` for scheduled maintenance (subscription expiry, renewal
  reminders, stale-token cleanup)
- Winston (structured logs to stdout)

### Shared & tooling
- Turborepo monorepo
- `@repo/types` — shared TypeScript types between frontend and backend
- ESLint, Prettier, Husky + lint-staged
- Jest + Supertest, run against a real Postgres database (not mocks)

## Project Structure

```
.
├── apps/
│   ├── backend/          Express API
│   │   ├── migrations/   node-pg-migrate schema migrations
│   │   ├── scripts/      seed.js, db control script's counterpart
│   │   ├── src/
│   │   │   ├── config/    env validation, Postgres pool
│   │   │   ├── middlewares/
│   │   │   └── modules/   one folder per domain: auth, user, address,
│   │   │                  order, payment, subscription, telegram, admin,
│   │   │                  settings, cron
│   │   └── tests/         unit + integration (real Postgres)
│   └── frontend/          Next.js client
├── packages/
│   └── types/             @repo/types — shared TS types
└── scripts/
    └── db.js              controls the local portable Postgres cluster
```

## Getting Started

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for full setup instructions,
including the local Postgres cluster, environment variables, seeding, and
troubleshooting. Short version:

```bash
npm install
npm run db:init      # creates a project-local Postgres cluster + databases
cp apps/backend/.env.example apps/backend/.env       # then fill in secrets
cp apps/frontend/.env.example apps/frontend/.env.local
npm run migrate:up
npm run seed
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:5000 (`/health`, `/ready`)
- Admin portal: http://localhost:3000/admin/login

### Common scripts

```bash
npm run dev          # frontend + backend together
npm test              # full test suite against a real Postgres database
npm run lint           # eslint across all workspaces
npm run type-check      # tsc across all workspaces
npm run build            # production build of both apps
npm run migrate:up | migrate:down
npm run db:start | db:stop | db:status | db:psql | db:reset
```

## Admin Portal

- **URL**: http://localhost:3000/admin/login
- **Access**: any account with `role = 'admin'` in the `users` table.
  `npm run seed` creates one automatically (credentials printed on run, or set
  `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` beforehand).

## Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/your-feature`).
3. Commit your changes — Husky runs lint-staged on commit.
4. Push and open a Pull Request.

CI (`.github/workflows/ci.yml`) runs lint, type-check, and the full test suite
against a real Postgres service container — the same one this monorepo tests
against locally.

## License

MIT.
