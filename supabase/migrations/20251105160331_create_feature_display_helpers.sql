/*
  # Create Feature Display Helpers

  1. New Functions
    - `get_feature_display_name` - Obtiene el nombre descriptivo de una funcionalidad desde el catálogo
    - `get_feature_display_info` - Obtiene información completa de una funcionalidad

  2. Purpose
    - Facilita la obtención de nombres descriptivos de funcionalidades
    - Permite mostrar información amigable al usuario sobre cada funcionalidad
    - Útil para APIs y consultas que necesitan mostrar funcionalidades con sus nombres legibles

  3. Usage Example
    ```sql
    SELECT get_feature_display_name('max_users');
    -- Returns: "Máximo de Usuarios"

    SELECT get_feature_display_info('max_users');
    -- Returns: JSON with full feature info
    ```
*/

-- Function to get feature display name
CREATE OR REPLACE FUNCTION get_feature_display_name(feature_code text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT name
  FROM feature_catalog
  WHERE code = feature_code AND active = true
  LIMIT 1;
$$;

-- Function to get complete feature information
CREATE OR REPLACE FUNCTION get_feature_display_info(feature_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'code', code,
    'name', name,
    'description', description,
    'value_type', value_type,
    'unit', unit,
    'category', category
  )
  FROM feature_catalog
  WHERE code = feature_code AND active = true
  LIMIT 1;
$$;

-- Create index for faster feature lookups
CREATE INDEX IF NOT EXISTS idx_feature_catalog_code_active ON feature_catalog(code, active)
WHERE active = true;
