/*
  # Add MercadoPago Integration Fields to Plans

  1. Changes to `plans` table
    - Add `mp_preapproval_plan_id` (text) - ID del plan en MercadoPago
    - Add `mp_status` (text) - Estado del plan en MercadoPago (active, paused, cancelled)
    - Add `mp_init_point` (text) - URL de checkout de MercadoPago
    - Add `mp_back_url` (text) - URL de retorno después del pago
    - Add `mp_collector_id` (bigint) - ID del cobrador en MercadoPago
    - Add `mp_application_id` (bigint) - ID de la aplicación en MercadoPago
    - Add `mp_date_created` (timestamptz) - Fecha de creación en MercadoPago
    - Add `mp_last_modified` (timestamptz) - Última modificación en MercadoPago
    - Add `mp_response` (jsonb) - Respuesta completa de MercadoPago para referencia

  2. Notes
    - Estos campos permiten sincronizar planes con MercadoPago
    - mp_init_point es la URL que se usa para suscribirse al plan
    - mp_response guarda toda la información devuelta por MercadoPago
*/

-- Add MercadoPago fields to plans table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plans' AND column_name = 'mp_preapproval_plan_id'
  ) THEN
    ALTER TABLE plans ADD COLUMN mp_preapproval_plan_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plans' AND column_name = 'mp_status'
  ) THEN
    ALTER TABLE plans ADD COLUMN mp_status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plans' AND column_name = 'mp_init_point'
  ) THEN
    ALTER TABLE plans ADD COLUMN mp_init_point text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plans' AND column_name = 'mp_back_url'
  ) THEN
    ALTER TABLE plans ADD COLUMN mp_back_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plans' AND column_name = 'mp_collector_id'
  ) THEN
    ALTER TABLE plans ADD COLUMN mp_collector_id bigint;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plans' AND column_name = 'mp_application_id'
  ) THEN
    ALTER TABLE plans ADD COLUMN mp_application_id bigint;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plans' AND column_name = 'mp_date_created'
  ) THEN
    ALTER TABLE plans ADD COLUMN mp_date_created timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plans' AND column_name = 'mp_last_modified'
  ) THEN
    ALTER TABLE plans ADD COLUMN mp_last_modified timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plans' AND column_name = 'mp_response'
  ) THEN
    ALTER TABLE plans ADD COLUMN mp_response jsonb;
  END IF;
END $$;

-- Create index for quick lookups by MercadoPago plan ID
CREATE INDEX IF NOT EXISTS idx_plans_mp_preapproval_plan_id ON plans(mp_preapproval_plan_id);

-- Add comment to table
COMMENT ON COLUMN plans.mp_preapproval_plan_id IS 'ID del plan en MercadoPago';
COMMENT ON COLUMN plans.mp_status IS 'Estado del plan en MercadoPago (active, paused, cancelled)';
COMMENT ON COLUMN plans.mp_init_point IS 'URL de checkout para suscribirse al plan';
COMMENT ON COLUMN plans.mp_back_url IS 'URL de retorno después del pago';
COMMENT ON COLUMN plans.mp_response IS 'Respuesta completa de MercadoPago para referencia';