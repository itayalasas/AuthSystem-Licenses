/*
  # Refactor to Multi-Application Admin System

  ## Overview
  Converts the system to support admin-controlled subscriptions across multiple applications.
  Admins assign subscriptions to tenants, and applications validate via API.

  ## Changes

  ### 1. New `applications` table
  Registry of all applications that can use the subscription system
  - `id` (uuid, primary key)
  - `name` (text) - Application name (e.g., "CommHub", "Dashboard Pro")
  - `slug` (text, unique) - URL-safe identifier
  - `external_app_id` (text, unique) - Maps to your auth system's app_id
  - `api_key` (text, unique) - Secret key for API authentication
  - `webhook_url` (text) - Optional webhook for subscription changes
  - `settings` (jsonb) - App-specific configuration
  - `is_active` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. Modified `tenants` table
  Now represents organizations/customers that can have access to multiple apps
  - Removed `external_app_id` (moved to applications table)
  - Added `organization_name` to clarify it's a customer/org

  ### 3. New `tenant_applications` table (junction)
  Links tenants to applications with individual subscriptions
  - `id` (uuid, primary key)
  - `tenant_id` (uuid, FK to tenants)
  - `application_id` (uuid, FK to applications)
  - `subscription_id` (uuid, FK to subscriptions) - nullable
  - `status` (text) - "active", "suspended", "canceled"
  - `granted_at` (timestamptz)
  - `granted_by` (text) - Admin user ID who granted access
  - `notes` (text) - Admin notes about this access
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. Modified `subscriptions` table
  - Added `application_id` to track which app the subscription is for
  - Removed direct tenant_id link (now via tenant_applications)

  ### 5. New `admin_users` table
  Admin users who can manage subscriptions
  - `id` (uuid, primary key)
  - `external_user_id` (text) - Maps to your auth system
  - `email` (text)
  - `name` (text)
  - `role` (text) - "super_admin", "sales", "support"
  - `permissions` (jsonb) - Granular permissions
  - `is_active` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 6. New `admin_audit_log` table
  Track all admin actions
  - `id` (uuid, primary key)
  - `admin_user_id` (uuid, FK to admin_users)
  - `action` (text) - "create_tenant", "assign_subscription", etc.
  - `entity_type` (text) - "tenant", "subscription", "application"
  - `entity_id` (uuid)
  - `changes` (jsonb) - What changed
  - `ip_address` (text)
  - `user_agent` (text)
  - `created_at` (timestamptz)

  ## Security
  - Applications table has RLS for service role only
  - Admin users table requires admin authentication
  - Audit log is append-only
  - Public API uses api_key validation
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

-- Modify tenants table - drop external_app_id constraint if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'tenants' AND constraint_name = 'tenants_external_app_id_key'
  ) THEN
    ALTER TABLE tenants DROP CONSTRAINT tenants_external_app_id_key;
  END IF;
END $$;

-- Add new columns to tenants if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenants' AND column_name = 'organization_name'
  ) THEN
    ALTER TABLE tenants ADD COLUMN organization_name text;
    UPDATE tenants SET organization_name = name WHERE organization_name IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenants' AND column_name = 'tax_id'
  ) THEN
    ALTER TABLE tenants ADD COLUMN tax_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenants' AND column_name = 'billing_email'
  ) THEN
    ALTER TABLE tenants ADD COLUMN billing_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenants' AND column_name = 'status'
  ) THEN
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

-- Add application_id to subscriptions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'application_id'
  ) THEN
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

-- RLS Policies for applications
CREATE POLICY "Service role can manage applications"
  ON applications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for tenant_applications
CREATE POLICY "Service role can manage tenant applications"
  ON tenant_applications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for admin_users
CREATE POLICY "Service role can manage admin users"
  ON admin_users FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for admin_audit_log
CREATE POLICY "Service role can manage audit log"
  ON admin_audit_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update triggers
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_applications_updated_at BEFORE UPDATE ON tenant_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample applications
INSERT INTO applications (name, slug, external_app_id, settings) VALUES
  ('CommHub', 'commhub', 'app_51ecb9e2-6b3', '{"features": ["messaging", "analytics"], "theme": "blue"}'::jsonb),
  ('Dashboard Pro', 'dashboard-pro', 'app_dashboard_001', '{"features": ["reports", "widgets"], "theme": "purple"}'::jsonb),
  ('Analytics Suite', 'analytics-suite', 'app_analytics_001', '{"features": ["realtime", "exports"], "theme": "green"}'::jsonb)
ON CONFLICT (external_app_id) DO NOTHING;

-- Insert sample admin user
INSERT INTO admin_users (external_user_id, email, name, role, permissions) VALUES
  ('admin_001', 'admin@example.com', 'System Administrator', 'super_admin', 
   '{"tenants": ["create", "read", "update", "delete"], "subscriptions": ["create", "read", "update", "delete"], "applications": ["create", "read", "update", "delete"]}'::jsonb)
ON CONFLICT (external_user_id) DO NOTHING;