-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_app_id text,
  name text NOT NULL,
  owner_user_id text NOT NULL,
  owner_email text NOT NULL,
  domain text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create plans table
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  trial_days integer DEFAULT 14,
  entitlements jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  plan_id uuid REFERENCES plans(id) NOT NULL,
  status text NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'paused', 'expired')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  payment_provider text CHECK (payment_provider IN ('mercadopago', 'dlocal', 'stripe')),
  provider_subscription_id text,
  provider_customer_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tenants_external_app_id ON tenants(external_app_id);
CREATE INDEX IF NOT EXISTS idx_tenants_owner_user_id ON tenants(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(period_end);

-- Enable Row Level Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Service role can manage all tenants"
  ON tenants FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can view active plans"
  ON plans FOR SELECT USING (is_active = true);

CREATE POLICY "Service role can manage plans"
  ON plans FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage all subscriptions"
  ON subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create trigger to sync period columns
CREATE OR REPLACE FUNCTION sync_subscription_period_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_period_start IS NOT NULL THEN
    NEW.period_start = NEW.current_period_start;
  END IF;
  IF NEW.current_period_end IS NOT NULL THEN
    NEW.period_end = NEW.current_period_end;
  END IF;
  IF NEW.period_start IS NOT NULL AND NEW.current_period_start IS NULL THEN
    NEW.current_period_start = NEW.period_start;
  END IF;
  IF NEW.period_end IS NOT NULL AND NEW.current_period_end IS NULL THEN
    NEW.current_period_end = NEW.period_end;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_subscriptions_period_columns
  BEFORE INSERT OR UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION sync_subscription_period_columns();