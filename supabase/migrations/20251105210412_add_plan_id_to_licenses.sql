/*
  # Agregar columna plan_id a licenses

  ## Descripción
  Agrega la columna `plan_id` a la tabla `licenses` para identificar
  qué plan está asociado a cada licencia. Esto permite conocer directamente
  los límites y características del plan sin necesidad de hacer JOIN con subscriptions.

  ## Cambios
  1. Agrega columna `plan_id` (uuid, FK a plans)
  2. Crea índice para búsquedas eficientes
  3. Actualiza registros existentes usando datos de subscription
  4. Hace la columna NOT NULL después de la migración de datos

  ## Seguridad
  - Se preservan todas las políticas RLS existentes
  - La columna es requerida para nuevas licencias
*/

-- Agregar columna plan_id (nullable inicialmente para migración)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'licenses' AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE licenses ADD COLUMN plan_id uuid REFERENCES plans(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Actualizar registros existentes con plan_id desde subscriptions
UPDATE licenses l
SET plan_id = s.plan_id
FROM subscriptions s
WHERE l.subscription_id = s.id
  AND l.plan_id IS NULL;

-- Crear índice para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_licenses_plan_id ON licenses(plan_id);

-- Hacer la columna NOT NULL ahora que todos los registros tienen valor
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM licenses WHERE plan_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot make plan_id NOT NULL: found % licenses without plan_id',
      (SELECT COUNT(*) FROM licenses WHERE plan_id IS NULL);
  END IF;
  
  ALTER TABLE licenses ALTER COLUMN plan_id SET NOT NULL;
END $$;

-- Comentario para documentación
COMMENT ON COLUMN licenses.plan_id IS 
  'Referencia al plan asociado con esta licencia para acceso directo a límites y características';
