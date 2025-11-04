/*
  # Subscription & Licensing System

  ## Overview
  Complete subscription management system that integrates with external authentication.
  Supports trial periods, multiple plans, payment provider integration, and usage tracking.
*/

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_app_id text UNIQUE NOT NULL,
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
  name text UNIQUE NOT NULL,
  description text,
  price numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'UYU',
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
  status text NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'paused')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
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

-- Create licenses table
CREATE TABLE IF NOT EXISTS licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE NOT NULL,
  jti text UNIQUE NOT NULL,
  type text NOT NULL CHECK (type IN ('trial', 'paid')),
  status text NOT NULL CHECK (status IN ('active', 'revoked', 'expired')),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  entitlements jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  payment_provider text,
  provider_invoice_id text,
  issued_at timestamptz NOT NULL,
  due_at timestamptz,
  paid_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create usage table
CREATE TABLE IF NOT EXISTS usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  metric text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  recorded_at timestamptz DEFAULT now()
);

-- Create webhook_events table
CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed boolean DEFAULT false,
  processed_at timestamptz,
  error text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tenants_external_app_id ON tenants(external_app_id);
CREATE INDEX IF NOT EXISTS idx_tenants_owner_user_id ON tenants(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(period_end);
CREATE INDEX IF NOT EXISTS idx_licenses_tenant_id ON licenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_licenses_jti ON licenses(jti);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_expires_at ON licenses(expires_at);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_usage_tenant_id ON usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_metric ON usage(metric);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);

-- Enable Row Level Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Service role can manage all tenants"
  ON tenants FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can view active plans"
  ON plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role can manage plans"
  ON plans FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage all subscriptions"
  ON subscriptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage all licenses"
  ON licenses FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage all invoices"
  ON invoices FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage all usage"
  ON usage FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage webhook events"
  ON webhook_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Insert default plans
INSERT INTO plans (name, description, price, currency, billing_cycle, trial_days, entitlements, sort_order) VALUES
  ('Starter', 'Plan básico para equipos pequeños', 15.00, 'USD', 'monthly', 14, 
   '{"max_users": 3, "features": {"advanced_reports": false, "api_access": false, "priority_support": false}, "limits": {"storage_gb": 2, "monthly_emails": 500}}'::jsonb, 1),
  ('Business', 'Plan intermedio para equipos en crecimiento', 45.00, 'USD', 'monthly', 14,
   '{"max_users": 10, "features": {"advanced_reports": true, "api_access": true, "priority_support": false}, "limits": {"storage_gb": 10, "monthly_emails": 5000}}'::jsonb, 2),
  ('Pro', 'Plan avanzado con todas las funciones', 95.00, 'USD', 'monthly', 14,
   '{"max_users": 25, "features": {"advanced_reports": true, "api_access": true, "priority_support": true}, "limits": {"storage_gb": 50, "monthly_emails": 20000}}'::jsonb, 3)
ON CONFLICT (name) DO NOTHING;

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