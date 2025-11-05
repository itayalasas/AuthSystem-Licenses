/*
  # Create Feature Catalog System

  1. New Tables
    - `feature_catalog`
      - `id` (uuid, primary key)
      - `code` (text, unique) - Código único de la funcionalidad (ej: max_users)
      - `name` (text) - Nombre descriptivo (ej: Máximo de Usuarios)
      - `description` (text) - Descripción detallada
      - `value_type` (text) - Tipo de valor: 'number', 'boolean', 'text'
      - `default_value` (text) - Valor por defecto sugerido
      - `category` (text) - Categoría (ej: limits, features, integrations)
      - `unit` (text, nullable) - Unidad de medida (ej: users, GB, calls)
      - `active` (boolean) - Si está activa para usar
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `feature_catalog` table
    - Add policies for authenticated admin users to manage catalog
    - Public read access for active features

  3. Initial Data
    - Pre-populate with common features

  4. Notes
    - This creates a centralized catalog of all available features
    - Features can be searched and filtered by name/code
    - Supports different value types for flexibility
*/

-- Create feature catalog table
CREATE TABLE IF NOT EXISTS feature_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  value_type text NOT NULL DEFAULT 'number' CHECK (value_type IN ('number', 'boolean', 'text')),
  default_value text DEFAULT '0',
  category text NOT NULL DEFAULT 'limits',
  unit text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster searches
CREATE INDEX IF NOT EXISTS idx_feature_catalog_code ON feature_catalog(code);
CREATE INDEX IF NOT EXISTS idx_feature_catalog_name ON feature_catalog(name);
CREATE INDEX IF NOT EXISTS idx_feature_catalog_active ON feature_catalog(active);
CREATE INDEX IF NOT EXISTS idx_feature_catalog_category ON feature_catalog(category);

-- Enable RLS
ALTER TABLE feature_catalog ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active features
CREATE POLICY "Active features are publicly readable"
  ON feature_catalog
  FOR SELECT
  USING (active = true);

-- Policy: Authenticated users can read all features
CREATE POLICY "Authenticated users can read all features"
  ON feature_catalog
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only authenticated users can insert features
CREATE POLICY "Authenticated users can insert features"
  ON feature_catalog
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Only authenticated users can update features
CREATE POLICY "Authenticated users can update features"
  ON feature_catalog
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Only authenticated users can delete features
CREATE POLICY "Authenticated users can delete features"
  ON feature_catalog
  FOR DELETE
  TO authenticated
  USING (true);

-- Insert initial feature catalog
INSERT INTO feature_catalog (code, name, description, value_type, default_value, category, unit) VALUES
  -- User & Account Limits
  ('max_users', 'Máximo de Usuarios', 'Número máximo de usuarios que pueden registrarse en la aplicación', 'number', '50', 'limits', 'usuarios'),
  ('max_admin_users', 'Máximo de Administradores', 'Número máximo de usuarios con rol de administrador', 'number', '5', 'limits', 'usuarios'),
  ('max_team_members', 'Máximo de Miembros del Equipo', 'Número máximo de miembros en un equipo', 'number', '10', 'limits', 'usuarios'),
  
  -- Storage & Resources
  ('max_storage_gb', 'Almacenamiento Máximo', 'Capacidad máxima de almacenamiento disponible', 'number', '100', 'limits', 'GB'),
  ('max_file_size_mb', 'Tamaño Máximo de Archivo', 'Tamaño máximo permitido por archivo individual', 'number', '50', 'limits', 'MB'),
  ('max_bandwidth_gb', 'Ancho de Banda Mensual', 'Transferencia de datos máxima por mes', 'number', '500', 'limits', 'GB'),
  
  -- Projects & Applications
  ('max_projects', 'Máximo de Proyectos', 'Número máximo de proyectos que se pueden crear', 'number', '10', 'limits', 'proyectos'),
  ('max_applications', 'Máximo de Aplicaciones', 'Número máximo de aplicaciones que se pueden registrar', 'number', '5', 'limits', 'aplicaciones'),
  ('max_environments', 'Máximo de Entornos', 'Número máximo de entornos por proyecto', 'number', '3', 'limits', 'entornos'),
  
  -- API & Integrations
  ('api_calls_per_day', 'Llamadas API Diarias', 'Número máximo de llamadas a la API por día', 'number', '1000', 'limits', 'llamadas/día'),
  ('api_calls_per_month', 'Llamadas API Mensuales', 'Número máximo de llamadas a la API por mes', 'number', '30000', 'limits', 'llamadas/mes'),
  ('api_rate_limit', 'Límite de Tasa API', 'Número de peticiones por minuto permitidas', 'number', '60', 'limits', 'req/min'),
  ('webhook_endpoints', 'Endpoints de Webhook', 'Número máximo de webhooks configurables', 'number', '10', 'limits', 'endpoints'),
  
  -- Features (Boolean)
  ('custom_domain', 'Dominio Personalizado', 'Permite configurar un dominio personalizado', 'boolean', 'false', 'features', null),
  ('white_label', 'Marca Blanca', 'Permite personalización completa de marca', 'boolean', 'false', 'features', null),
  ('api_access', 'Acceso a API', 'Habilita acceso completo a la API REST', 'boolean', 'true', 'features', null),
  ('advanced_analytics', 'Analítica Avanzada', 'Acceso a reportes y analíticas avanzadas', 'boolean', 'false', 'features', null),
  ('priority_support', 'Soporte Prioritario', 'Soporte técnico con respuesta prioritaria', 'boolean', 'false', 'features', null),
  ('sso_integration', 'Integración SSO', 'Single Sign-On con proveedores externos', 'boolean', 'false', 'features', null),
  ('backup_restore', 'Respaldo y Restauración', 'Copias de seguridad automáticas y restauración', 'boolean', 'true', 'features', null),
  ('audit_logs', 'Registros de Auditoría', 'Logs detallados de todas las acciones del sistema', 'boolean', 'false', 'features', null),
  ('export_data', 'Exportación de Datos', 'Permite exportar datos en múltiples formatos', 'boolean', 'true', 'features', null),
  ('custom_reports', 'Reportes Personalizados', 'Creación de reportes personalizados', 'boolean', 'false', 'features', null),
  
  -- Advanced Features
  ('max_custom_fields', 'Campos Personalizados', 'Número máximo de campos personalizados', 'number', '20', 'features', 'campos'),
  ('max_workflows', 'Flujos de Trabajo', 'Número máximo de workflows automatizados', 'number', '5', 'features', 'workflows'),
  ('max_integrations', 'Integraciones', 'Número máximo de integraciones con servicios externos', 'number', '10', 'features', 'integraciones'),
  
  -- Support & Service
  ('support_response_time', 'Tiempo de Respuesta', 'Tiempo máximo de respuesta del soporte (en horas)', 'number', '24', 'support', 'horas'),
  ('support_channels', 'Canales de Soporte', 'Canales disponibles para soporte (email, chat, phone)', 'text', 'email', 'support', null),
  
  -- Collaboration
  ('max_concurrent_users', 'Usuarios Concurrentes', 'Número máximo de usuarios conectados simultáneamente', 'number', '20', 'limits', 'usuarios'),
  ('real_time_collaboration', 'Colaboración en Tiempo Real', 'Permite edición colaborativa en tiempo real', 'boolean', 'false', 'features', null),
  
  -- Security
  ('two_factor_auth', 'Autenticación de Dos Factores', 'Requiere 2FA para todos los usuarios', 'boolean', 'false', 'security', null),
  ('ip_whitelist', 'Lista Blanca de IPs', 'Permite restringir acceso por IP', 'boolean', 'false', 'security', null),
  ('encryption_at_rest', 'Encriptación en Reposo', 'Datos encriptados en el almacenamiento', 'boolean', 'true', 'security', null)
ON CONFLICT (code) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_feature_catalog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_feature_catalog_updated_at ON feature_catalog;
CREATE TRIGGER trigger_update_feature_catalog_updated_at
  BEFORE UPDATE ON feature_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_catalog_updated_at();
