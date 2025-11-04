/*
  # Refactor to Multi-Application Admin System
*/

-- Create applications table
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  external_app_id text UNIQUE NOT NULL,
  api_key text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  webhook_url text,
  settings jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Modify tenants table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'tenants' AND constraint_name = 'tenants_external_app_id_key'
  ) THEN
    ALTER TABLE tenants DROP CONSTRAINT tenants_external_app_id_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'organization_name') THEN
    ALTER TABLE tenants ADD COLUMN organization_name text;
    UPDATE tenants SET organization_name = name WHERE organization_name IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'tax_id') THEN
    ALTER TABLE tenants ADD COLUMN tax_id text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'billing_email') THEN
    ALTER TABLE tenants ADD COLUMN billing_email text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'status') THEN
    ALTER TABLE tenants ADD COLUMN status text DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'canceled'));
  END IF;
END $$;

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

-- Add application_id to subscriptions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'application_id') THEN
    ALTER TABLE subscriptions ADD COLUMN application_id uuid REFERENCES applications(id);
  END IF;
END $$;

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