/*
  # Agregar columna application_id a licenses

  ## Descripción
  Agrega la columna `application_id` a la tabla `licenses` para identificar
  a qué aplicación pertenece cada licencia. Esto es necesario para el sistema
  multi-aplicación donde cada licencia debe estar asociada a una aplicación específica.

  ## Cambios
  1. Agrega columna `application_id` (uuid, FK a applications)
  2. Crea índice para búsquedas eficientes
  3. Actualiza registros existentes usando datos de subscription
  4. Hace la columna NOT NULL después de la migración de datos

  ## Seguridad
  - Se preservan todas las políticas RLS existentes
  - La columna es requerida para nuevas licencias
*/

-- Agregar columna application_id (nullable inicialmente para migración)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'licenses' AND column_name = 'application_id'
  ) THEN
    ALTER TABLE licenses ADD COLUMN application_id uuid REFERENCES applications(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Actualizar registros existentes con application_id desde subscriptions
UPDATE licenses l
SET application_id = s.application_id
FROM subscriptions s
WHERE l.subscription_id = s.id
  AND l.application_id IS NULL;

-- Crear índice para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_licenses_application_id ON licenses(application_id);

-- Hacer la columna NOT NULL ahora que todos los registros tienen valor
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM licenses WHERE application_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot make application_id NOT NULL: found % licenses without application_id',
      (SELECT COUNT(*) FROM licenses WHERE application_id IS NULL);
  END IF;
  
  ALTER TABLE licenses ALTER COLUMN application_id SET NOT NULL;
END $$;

-- Comentario para documentación
COMMENT ON COLUMN licenses.application_id IS 
  'Referencia a la aplicación para la cual se emitió esta licencia';
