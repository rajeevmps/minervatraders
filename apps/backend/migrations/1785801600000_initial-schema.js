/* eslint-disable camelcase */

/**
 * Consolidated initial schema.
 *
 * Replaces four contradictory legacy SQL files (infra/supabase/schema.sql,
 * supabase/migrations/*, apps/backend/supabase_setup.sql,
 * apps/backend/supabase_user_sync_trigger.sql) with a single versioned source
 * of truth, and removes every Supabase dependency:
 *
 *   - `users` now owns identity (password_hash, telegram_user_id) instead of
 *     being a shadow copy of `auth.users` populated by triggers.
 *   - The `admins` table is gone. Admin status is `users.role`, resolved
 *     server-side. The old design required a second query on every admin
 *     request and left the admin roster readable by the public anon key.
 *   - All RLS policies are dropped. The backend has always used a service-role
 *     key that bypassed RLS, so the policies were never load-bearing;
 *     ownership is enforced in application code.
 *   - Timestamps are TIMESTAMPTZ, not TIMESTAMP. The legacy schema stored
 *     naive local times, which silently misbehaves across timezones.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()
    CREATE EXTENSION IF NOT EXISTS citext;    -- case-insensitive email

    -- Keeps updated_at honest without relying on application code.
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- ========================================================== users
    CREATE TABLE users (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email              CITEXT UNIQUE NOT NULL,
      password_hash      TEXT,
      full_name          TEXT,
      avatar_url         TEXT,
      telegram_user_id   BIGINT UNIQUE,
      telegram_username  TEXT,
      role               TEXT NOT NULL DEFAULT 'user',
      email_verified     BOOLEAN NOT NULL DEFAULT FALSE,
      is_active          BOOLEAN NOT NULL DEFAULT TRUE,
      last_login_at      TIMESTAMPTZ,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

      CONSTRAINT users_role_check CHECK (role IN ('user', 'admin')),
      -- An account must be reachable by at least one credential type,
      -- otherwise it can never be logged into.
      CONSTRAINT users_has_credential CHECK (
        password_hash IS NOT NULL OR telegram_user_id IS NOT NULL
      )
    );
    CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    -- ================================================ refresh_tokens
    -- Only the SHA-256 of each token is stored, so a database leak does not
    -- hand out usable sessions. replaced_by records the rotation chain, which
    -- makes token-reuse detection possible.
    CREATE TABLE refresh_tokens (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash   TEXT NOT NULL UNIQUE,
      expires_at   TIMESTAMPTZ NOT NULL,
      revoked_at   TIMESTAMPTZ,
      replaced_by  UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL,
      user_agent   TEXT,
      ip_address   INET,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
    CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

    -- ============================================= subscription_plans
    -- price/sale_price are whole RUPEES (integers, so no float rounding).
    -- razorpay.service multiplies by 100 to get the paise the gateway expects.
    CREATE TABLE subscription_plans (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      -- UNIQUE so seeding can upsert on the natural key.
      name           TEXT NOT NULL UNIQUE,
      description    TEXT,
      price          INTEGER NOT NULL,
      sale_price     INTEGER,
      currency       TEXT NOT NULL DEFAULT 'INR',
      duration_days  INTEGER NOT NULL,
      is_active      BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order     INTEGER NOT NULL DEFAULT 0,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

      CONSTRAINT plans_price_check CHECK (price >= 0),
      CONSTRAINT plans_sale_price_check CHECK (sale_price IS NULL OR sale_price >= 0),
      CONSTRAINT plans_duration_check CHECK (duration_days > 0)
    );
    CREATE TRIGGER plans_set_updated_at BEFORE UPDATE ON subscription_plans
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    -- ========================================================= orders
    CREATE TABLE orders (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      total_amount       INTEGER NOT NULL,
      currency           TEXT NOT NULL DEFAULT 'INR',
      status             TEXT NOT NULL DEFAULT 'pending',
      -- UNIQUE is required: the webhook handler upserts on this column.
      razorpay_order_id  TEXT UNIQUE,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

      CONSTRAINT orders_status_check
        CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'cancelled'))
    );
    CREATE INDEX idx_orders_user ON orders(user_id);
    CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON orders
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    CREATE TABLE order_items (
      id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id  UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      plan_id   UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
      price     INTEGER NOT NULL
    );
    CREATE INDEX idx_order_items_order ON order_items(order_id);

    -- ============================================== user_subscriptions
    CREATE TABLE user_subscriptions (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id     UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
      -- Was a bare UUID with no FK in the legacy schema.
      order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
      start_date  TIMESTAMPTZ NOT NULL DEFAULT now(),
      end_date    TIMESTAMPTZ NOT NULL,
      status      TEXT NOT NULL DEFAULT 'active',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

      CONSTRAINT subs_status_check
        CHECK (status IN ('pending', 'active', 'expired', 'cancelled', 'refunded', 'failed')),
      CONSTRAINT subs_date_order CHECK (end_date > start_date)
    );
    CREATE INDEX idx_subs_user ON user_subscriptions(user_id);
    -- Drives the expiry cron scan.
    CREATE INDEX idx_subs_status_end_date ON user_subscriptions(status, end_date);
    -- At most one live subscription per user (single-tenant product).
    CREATE UNIQUE INDEX idx_subs_one_active_per_user
      ON user_subscriptions(user_id) WHERE status = 'active';
    CREATE TRIGGER subs_set_updated_at BEFORE UPDATE ON user_subscriptions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    -- ======================================================= payments
    CREATE TABLE payments (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id             UUID REFERENCES orders(id) ON DELETE SET NULL,
      user_id              UUID REFERENCES users(id) ON DELETE SET NULL,
      -- UNIQUE enforces webhook idempotency at the database level rather than
      -- relying solely on the application check.
      razorpay_payment_id  TEXT UNIQUE,
      razorpay_signature   TEXT,
      amount               INTEGER,
      currency             TEXT NOT NULL DEFAULT 'INR',
      status               TEXT,
      method               TEXT,
      webhook_event        TEXT,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_payments_order ON payments(order_id);
    CREATE INDEX idx_payments_user ON payments(user_id);

    -- ====================================================== addresses
    CREATE TABLE addresses (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      full_name   TEXT,
      phone       TEXT,
      street      TEXT,
      city        TEXT,
      state       TEXT,
      pincode     TEXT,
      country     TEXT,
      is_default  BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_addresses_user ON addresses(user_id);
    CREATE UNIQUE INDEX idx_addresses_one_default_per_user
      ON addresses(user_id) WHERE is_default;
    CREATE TRIGGER addresses_set_updated_at BEFORE UPDATE ON addresses
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    -- ============================================== telegram_access
    -- telegram_user_id is BIGINT here (it was VARCHAR); Telegram ids are numeric
    -- and already exceed 32 bits.
    CREATE TABLE telegram_access (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      -- UNIQUE is required: the invite flow upserts on user_id.
      user_id            UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      telegram_user_id   BIGINT,
      telegram_username  TEXT,
      invite_link        TEXT,
      status             TEXT NOT NULL DEFAULT 'pending',
      joined_at          TIMESTAMPTZ,
      expires_at         TIMESTAMPTZ,
      is_active          BOOLEAN NOT NULL DEFAULT TRUE,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

      CONSTRAINT telegram_status_check
        CHECK (status IN ('pending', 'invited', 'joined', 'revoked'))
    );
    CREATE TRIGGER telegram_set_updated_at BEFORE UPDATE ON telegram_access
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    -- =================================================== webhook_logs
    CREATE TABLE webhook_logs (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      provider    TEXT NOT NULL DEFAULT 'razorpay',
      event_type  TEXT,
      -- Provider-side event id; UNIQUE makes replayed deliveries a no-op.
      event_id    TEXT,
      payload     JSONB,
      signature   TEXT,
      processed   BOOLEAN NOT NULL DEFAULT FALSE,
      error       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX idx_webhook_logs_event
      ON webhook_logs(provider, event_id) WHERE event_id IS NOT NULL;

    -- ===================================================== audit_logs
    -- FK repointed from auth.users to public.users.
    CREATE TABLE audit_logs (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
      action      TEXT NOT NULL,
      details     JSONB NOT NULL DEFAULT '{}'::jsonb,
      ip_address  INET,
      user_agent  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

    -- ================================================ system_settings
    -- Queried in three places by the app but defined in no legacy SQL file.
    CREATE TABLE system_settings (
      key         TEXT PRIMARY KEY,
      value       TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER settings_set_updated_at BEFORE UPDATE ON system_settings
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = (pgm) => {
    pgm.sql(`
    DROP TABLE IF EXISTS system_settings, audit_logs, webhook_logs, telegram_access,
                         addresses, payments, user_subscriptions, order_items,
                         orders, subscription_plans, refresh_tokens, users CASCADE;
    DROP FUNCTION IF EXISTS set_updated_at();
  `);
};
