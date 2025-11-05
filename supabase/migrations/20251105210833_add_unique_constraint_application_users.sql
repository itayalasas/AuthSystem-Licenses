/*
  # Agregar constraint único para application_users

  ## Descripción
  Agrega un constraint UNIQUE a la tabla `application_users` para la combinación
  de `application_id` y `external_user_id`. Esto permite hacer UPSERT correctamente
  durante la sincronización de usuarios desde sistemas externos.

  ## Cambios
  1. Elimina duplicados existentes si los hay
  2. Crea constraint UNIQUE en (application_id, external_user_id)
  3. Crea índice para búsquedas eficientes

  ## Seguridad
  - Se preservan todas las políticas RLS existentes
  - Garantiza que un usuario externo solo aparezca una vez por aplicación
*/

-- Eliminar duplicados si existen (mantener el más reciente)
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY application_id, external_user_id 
      ORDER BY created_at DESC, id DESC
    ) as rn
  FROM application_users
)
DELETE FROM application_users
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Crear constraint único
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'application_users_app_external_user_key'
  ) THEN
    ALTER TABLE application_users 
    ADD CONSTRAINT application_users_app_external_user_key 
    UNIQUE (application_id, external_user_id);
  END IF;
END $$;

-- Crear índice para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_application_users_app_external_user 
ON application_users(application_id, external_user_id);

-- Comentario para documentación
COMMENT ON CONSTRAINT application_users_app_external_user_key ON application_users IS 
  'Garantiza que cada usuario externo solo aparezca una vez por aplicación';
