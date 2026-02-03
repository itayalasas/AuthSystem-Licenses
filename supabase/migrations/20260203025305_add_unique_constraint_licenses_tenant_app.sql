/*
  # Agregar constraint única a licenses

  ## Descripción
  Agrega una constraint única en la combinación de (tenant_id, application_id)
  para la tabla licenses. Esto asegura que un tenant solo puede tener una
  licencia activa por aplicación, lo cual es necesario para el correcto
  funcionamiento del sistema de renovación de licencias.

  ## Cambios
  1. Agrega constraint única en (tenant_id, application_id)

  ## Seguridad
  - Se preservan todas las políticas RLS existentes
  - La constraint previene duplicados y permite el uso de upsert

  ## Notas
  - Los duplicados existentes fueron limpiados previamente
*/

-- Agregar la constraint única
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'licenses_tenant_application_key'
  ) THEN
    ALTER TABLE licenses
    ADD CONSTRAINT licenses_tenant_application_key
    UNIQUE (tenant_id, application_id);
  END IF;
END $$;

-- Comentario para documentación
COMMENT ON CONSTRAINT licenses_tenant_application_key ON licenses IS
  'Asegura que un tenant solo puede tener una licencia por aplicación';
