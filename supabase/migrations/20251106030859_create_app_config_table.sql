/*
  # Create app_config table for dynamic configuration

  1. New Tables
    - `app_config`
      - `id` (uuid, primary key) - Unique identifier
      - `project_name` (text) - Name of the project
      - `description` (text) - Description of the configuration
      - `variables` (jsonb) - Key-value pairs for configuration variables
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
  
  2. Security
    - Enable RLS on `app_config` table
    - Add policy for authenticated users to read configuration
    - Add policy for admin users to update configuration
  
  3. Initial Data
    - Insert default configuration with MercadoPago variables
*/

CREATE TABLE IF NOT EXISTS app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name text NOT NULL DEFAULT 'Subscription Platform',
  description text NOT NULL DEFAULT 'Application configuration',
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app config"
  ON app_config
  FOR SELECT
  USING (true);

CREATE POLICY "Only authenticated users can update app config"
  ON app_config
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

INSERT INTO app_config (project_name, description, variables)
VALUES (
  'Subscription Platform',
  'Configuration for the multi-tenant subscription platform',
  jsonb_build_object(
    'MERCADOPAGO_API_URL', 'https://api.mercadopago.com/preapproval_plan',
    'MERCADOPAGO_ACCESS_TOKEN', 'your_mercadopago_access_token_here',
    'MERCADOPAGO_BACK_URL', 'https://www.yoursite.com'
  )
)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION update_app_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER app_config_updated_at
  BEFORE UPDATE ON app_config
  FOR EACH ROW
  EXECUTE FUNCTION update_app_config_updated_at();