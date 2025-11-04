-- Create applications table
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  external_app_id text UNIQUE NOT NULL,
  api_key text UNIQUE NOT NULL DEFAULT 'ak_' || replace(gen_random_uuid()::text, '-', ''),
  webhook_url text,
  settings jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add columns to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS organization_name text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tax_id text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_email text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'canceled'));

UPDATE tenants SET organization_name = name WHERE organization_name IS NULL;

-- Create tenant_applications junction table
CREATE TABLE IF NOT EXISTS tenant_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE NOT NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'canceled')),
  granted_at timestamptz DEFAULT now(),
  granted_by text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, application_id)
);

-- Add application_id to subscriptions and plans
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES applications(id);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES applications(id) ON DELETE CASCADE;

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_user_id text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('super_admin', 'sales', 'support', 'viewer')),
  permissions jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create admin_audit_log table
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES admin_users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  changes jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_applications_external_app_id ON applications(external_app_id);
CREATE INDEX IF NOT EXISTS idx_applications_api_key ON applications(api_key);
CREATE INDEX IF NOT EXISTS idx_tenant_applications_tenant_id ON tenant_applications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_applications_application_id ON tenant_applications(application_id);
CREATE INDEX IF NOT EXISTS idx_tenant_applications_status ON tenant_applications(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_application_id ON subscriptions(application_id);
CREATE INDEX IF NOT EXISTS idx_plans_application_id ON plans(application_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_external_user_id ON admin_users(external_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user_id ON admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity ON admin_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at);

-- Enable RLS
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Service role can manage applications"
  ON applications FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage tenant applications"
  ON tenant_applications FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage admin users"
  ON admin_users FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage audit log"
  ON admin_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Triggers
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_applications_updated_at BEFORE UPDATE ON tenant_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default plans
INSERT INTO plans (name, description, price, currency, billing_cycle, trial_days, entitlements, sort_order) VALUES
  ('Starter', 'Plan básico para equipos pequeños', 15.00, 'USD', 'monthly', 14, 
   '{"max_users": 3, "max_storage_gb": 5, "features": {"advanced_reports": false, "api_access": false, "priority_support": false}}'::jsonb, 1),
  ('Business', 'Plan intermedio para equipos en crecimiento', 45.00, 'USD', 'monthly', 14,
   '{"max_users": 10, "max_storage_gb": 50, "features": {"advanced_reports": true, "api_access": true, "priority_support": false}}'::jsonb, 2),
  ('Pro', 'Plan avanzado con todas las funciones', 95.00, 'USD', 'monthly', 14,
   '{"max_users": 50, "max_storage_gb": 200, "features": {"advanced_reports": true, "api_access": true, "priority_support": true}}'::jsonb, 3)
ON CONFLICT DO NOTHING;