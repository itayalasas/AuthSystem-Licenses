/*
  # Agregar columna license_key a licenses

  ## Descripción
  Agrega la columna `license_key` a la tabla `licenses` para almacenar
  la clave de licencia única que se puede compartir/distribuir.
  Esta es diferente del JTI que es interno.

  ## Cambios
  1. Agrega columna `license_key` (text, unique)
  2. Genera claves únicas para registros existentes
  3. Crea índice único para búsquedas eficientes
  4. Hace la columna NOT NULL después de la migración de datos

  ## Seguridad
  - Se preservan todas las políticas RLS existentes
  - La columna es requerida para nuevas licencias
*/

-- Función para generar license keys únicas
CREATE OR REPLACE FUNCTION generate_license_key()
RETURNS text AS $$
BEGIN
  RETURN 'LIC-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)) || '-' ||
         upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)) || '-' ||
         upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
END;
$$ LANGUAGE plpgsql;

-- Agregar columna license_key (nullable inicialmente para migración)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'licenses' AND column_name = 'license_key'
  ) THEN
    ALTER TABLE licenses ADD COLUMN license_key text;
  END IF;
END $$;

-- Generar license keys para registros existentes
UPDATE licenses
SET license_key = generate_license_key()
WHERE license_key IS NULL;

-- Crear constraint de unicidad
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'licenses_license_key_key'
  ) THEN
    ALTER TABLE licenses ADD CONSTRAINT licenses_license_key_key UNIQUE (license_key);
  END IF;
END $$;

-- Crear índice para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_licenses_license_key ON licenses(license_key);

-- Hacer la columna NOT NULL ahora que todos los registros tienen valor
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM licenses WHERE license_key IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot make license_key NOT NULL: found % licenses without license_key',
      (SELECT COUNT(*) FROM licenses WHERE license_key IS NULL);
  END IF;
  
  ALTER TABLE licenses ALTER COLUMN license_key SET NOT NULL;
END $$;

-- Comentario para documentación
COMMENT ON COLUMN licenses.license_key IS 
  'Clave de licencia única legible que se puede distribuir a los usuarios';

COMMENT ON FUNCTION generate_license_key() IS
  'Genera una clave de licencia única en formato LIC-XXXXXXXX-XXXXXXXX-XXXXXXXX';
