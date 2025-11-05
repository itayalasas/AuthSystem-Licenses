/*
  # Crear tabla de Licencias (Licenses)

  ## Descripción
  Crea la tabla `licenses` para gestionar tokens de licencia temporales
  que se generan cuando un usuario valida su acceso a una aplicación.
  Estos tokens tienen una duración limitada (24 horas por defecto) y contienen
  los permisos y entitlements del usuario.

  ## Nueva Tabla

  ### `licenses`
  - `id` (uuid, PK): Identificador único de la licencia
  - `jti` (uuid, unique): JWT ID - Identificador único del token
  - `tenant_id` (uuid, FK): Referencia al tenant
  - `subscription_id` (uuid, FK): Referencia a la suscripción
  - `type` (text): Tipo de licencia (trial, paid, lifetime)
  - `status` (text): Estado (active, expired, revoked)
  - `issued_at` (timestamptz): Fecha de emisión
  - `expires_at` (timestamptz): Fecha de expiración
  - `last_validated_at` (timestamptz): Última validación
  - `entitlements` (jsonb): Permisos y límites del plan
  - `metadata` (jsonb): Datos adicionales
  - `created_at` (timestamptz): Fecha de creación
  - `updated_at` (timestamptz): Fecha de actualización

  ## Índices
  - Búsqueda por JTI (único)
  - Búsqueda por tenant
  - Búsqueda por suscripción
  - Búsqueda por estado y fecha de expiración

  ## Seguridad (RLS)
  - Service role tiene acceso completo
  - Las aplicaciones consultan vía validation-api
*/

-- Create licenses table
CREATE TABLE IF NOT EXISTS licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jti uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('trial', 'paid', 'lifetime', 'promotional')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'suspended')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_validated_at timestamptz,
  entitlements jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_licenses_jti ON licenses(jti);
CREATE INDEX IF NOT EXISTS idx_licenses_tenant_id ON licenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_licenses_subscription_id ON licenses(subscription_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_expires_at ON licenses(expires_at);
CREATE INDEX IF NOT EXISTS idx_licenses_status_expires ON licenses(status, expires_at);

-- Enable RLS
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

-- Policy for service role (full access)
CREATE POLICY "Service role has full access to licenses"
  ON licenses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_licenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on licenses
DROP TRIGGER IF EXISTS licenses_updated_at ON licenses;
CREATE TRIGGER licenses_updated_at
  BEFORE UPDATE ON licenses
  FOR EACH ROW
  EXECUTE FUNCTION update_licenses_updated_at();

-- Function to clean up expired licenses (can be called by cron)
CREATE OR REPLACE FUNCTION cleanup_expired_licenses()
RETURNS void AS $$
BEGIN
  -- Mark expired licenses as expired
  UPDATE licenses
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at < now();
  
  -- Optionally delete very old expired licenses (older than 30 days)
  DELETE FROM licenses
  WHERE status = 'expired'
    AND expires_at < now() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
