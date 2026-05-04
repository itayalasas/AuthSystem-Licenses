/*
  # Auth Type, User Limit y Tenant Members

  ## Resumen
  Soporte para aplicaciones híbridas con autenticación básica y por tenant.

  ## Cambios

  ### 1. applications
  - `auth_type` (text, default 'basic'): indica si la app usa auth básica ('basic'),
    por tenant ('tenant') o ambas ('hybrid').

  ### 2. plans
  - `user_limit` (integer, nullable): máximo de usuarios por suscripción.
    Solo aplica cuando la app tiene auth_type tenant. NULL = sin límite.

  ### 3. tenant_members (nueva tabla)
  Registra qué usuarios de AuthSystem pertenecen a cada tenant.
  Permite validar licencias a nivel de tenant para auth tipo tenant.
  - `id` (uuid pk)
  - `tenant_id` (uuid → tenants.id)
  - `application_id` (uuid → applications.id)
  - `external_user_id` (text): ID del usuario en AuthSystem
  - `email` (text)
  - `name` (text)
  - `status` (text)
  - `last_login` (timestamptz)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  - Unique: (tenant_id, external_user_id)

  ### 4. tenants
  - `auth_tenant_id` (text, nullable): ID del tenant en AuthSystem (external_id del tenant remoto).
    Permite vincular el tenant local con el tenant de AuthSystem.
  - `slug` (text, nullable): slug del tenant en AuthSystem.

  ## Seguridad
  - RLS habilitado en tenant_members
  - Políticas para lectura y escritura solo por service role (solo edge functions acceden)
*/

-- 1. Agregar auth_type a applications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'auth_type'
  ) THEN
    ALTER TABLE applications ADD COLUMN auth_type text NOT NULL DEFAULT 'basic'
      CHECK (auth_type IN ('basic', 'tenant', 'hybrid'));
  END IF;
END $$;

-- 2. Agregar user_limit a plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plans' AND column_name = 'user_limit'
  ) THEN
    ALTER TABLE plans ADD COLUMN user_limit integer DEFAULT NULL;
  END IF;
END $$;

-- 3. Agregar auth_tenant_id y slug a tenants (para vincular con AuthSystem)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'auth_tenant_id'
  ) THEN
    ALTER TABLE tenants ADD COLUMN auth_tenant_id text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'slug'
  ) THEN
    ALTER TABLE tenants ADD COLUMN slug text DEFAULT NULL;
  END IF;
END $$;

-- Index para buscar tenant por auth_tenant_id
CREATE INDEX IF NOT EXISTS idx_tenants_auth_tenant_id ON tenants(auth_tenant_id);

-- 4. Crear tabla tenant_members
CREATE TABLE IF NOT EXISTS tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  external_user_id text NOT NULL,
  email text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  last_login timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, external_user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant_id ON tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_external_user_id ON tenant_members(external_user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_application_id ON tenant_members(application_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_email ON tenant_members(email);

ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;

-- Solo service role accede a esta tabla (edge functions usan service role key)
CREATE POLICY "Service role full access to tenant_members"
  ON tenant_members FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role insert tenant_members"
  ON tenant_members FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role update tenant_members"
  ON tenant_members FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role delete tenant_members"
  ON tenant_members FOR DELETE
  TO service_role
  USING (true);
