/*
  # Create Application Users Table

  ## Purpose
  Track users assigned to each application to enforce user limits per subscription plan.

  ## New Tables
  - `application_users`
    - `id` (uuid, primary key) - Unique identifier
    - `application_id` (uuid, foreign key) - Reference to applications table
    - `external_user_id` (text) - User ID from external auth system
    - `email` (text) - User email address
    - `name` (text) - User full name
    - `status` (text) - User status (active, suspended, deleted)
    - `last_login` (timestamptz) - Last login timestamp
    - `metadata` (jsonb) - Additional user data
    - `created_at` (timestamptz) - When user was synced
    - `updated_at` (timestamptz) - Last sync time

  ## Indexes
  - Index on application_id for fast lookups
  - Unique index on (application_id, external_user_id) to prevent duplicates

  ## Security
  - Enable RLS on application_users table
  - Admins can read all user records
  - System can insert/update during sync
*/

-- Create application_users table
CREATE TABLE IF NOT EXISTS application_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  external_user_id text NOT NULL,
  email text NOT NULL,
  name text NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  last_login timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_application_users_application_id 
  ON application_users(application_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_application_users_unique_external 
  ON application_users(application_id, external_user_id);

CREATE INDEX IF NOT EXISTS idx_application_users_email 
  ON application_users(email);

-- Enable RLS
ALTER TABLE application_users ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can read all users
CREATE POLICY "Admins can read all application users"
  ON application_users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.external_user_id = auth.jwt() ->> 'sub'
      AND admin_users.is_active = true
    )
  );

-- Policy: Service role can insert/update during sync
CREATE POLICY "Service role can manage application users"
  ON application_users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_application_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER application_users_updated_at
  BEFORE UPDATE ON application_users
  FOR EACH ROW
  EXECUTE FUNCTION update_application_users_updated_at();
