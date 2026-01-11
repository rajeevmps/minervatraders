-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE NOT NULL,
  full_name VARCHAR,
  avatar_url TEXT,
  provider VARCHAR DEFAULT 'google',
  provider_id VARCHAR,
  role VARCHAR DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);


-- Admins Table
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Subscription Plans Table
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  price INT NOT NULL,
  duration_days INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User Subscriptions Table
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id),
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  status VARCHAR DEFAULT 'active',
  order_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);





-- Orders Table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  total_amount INT NOT NULL,
  currency VARCHAR DEFAULT 'INR',
  status VARCHAR DEFAULT 'pending',
  razorpay_order_id VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Order Items Table
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id),
  price INT NOT NULL
);

-- Payments Table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  user_id UUID REFERENCES users(id),
  razorpay_payment_id VARCHAR,
  razorpay_signature TEXT,
  amount INT,
  status VARCHAR,
  method VARCHAR,
  webhook_event VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Addresses Table
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  full_name VARCHAR,
  phone VARCHAR,
  street TEXT,
  city VARCHAR,
  state VARCHAR,
  pincode VARCHAR,
  country VARCHAR,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Telegram Access Table
CREATE TABLE telegram_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  telegram_user_id VARCHAR,
  invite_link TEXT,
  joined_at TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- Webhook Logs Table
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR,
  payload JSONB,
  signature TEXT,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit Logs Table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action VARCHAR,
  ip_address VARCHAR,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_subs_user ON user_subscriptions(user_id);

-- Seeding Subscription Plans
INSERT INTO subscription_plans (name, price, duration_days)
VALUES
('Monthly', 3000, 30),
('Quarterly', 8000, 90),
('Yearly', 28000, 365);

-- ROW LEVEL SECURITY (RLS)
-- Enable RLS on tables with sensitive user data
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_access ENABLE ROW LEVEL SECURITY;

-- Policies (user_id = auth.uid())

-- Users Policy
CREATE POLICY "Users can only access their own data" ON users
  FOR ALL USING (auth.uid() = id);

-- User Subscriptions Policy
CREATE POLICY "Users can only access their own subscriptions" ON user_subscriptions
  FOR ALL USING (auth.uid() = user_id);



-- Orders Policy
CREATE POLICY "Users can only access their own orders" ON orders
  FOR ALL USING (auth.uid() = user_id);

-- Payments Policy
CREATE POLICY "Users can only access their own payments" ON payments
  FOR ALL USING (auth.uid() = user_id);

-- Addresses Policy
CREATE POLICY "Users can only access their own addresses" ON addresses
  FOR ALL USING (auth.uid() = user_id);

-- Telegram Access Policy
CREATE POLICY "Users can only access their own telegram access" ON telegram_access
  FOR ALL USING (auth.uid() = user_id);

-- USER SYNC TRIGGER (Sync auth.users -> public.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
