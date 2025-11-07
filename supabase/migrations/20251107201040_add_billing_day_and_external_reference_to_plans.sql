/*
  # Add billing day and external reference to plans

  1. Changes
    - Add `billing_day` (integer) - Día del mes para facturación (1-31)
    - Add `external_reference` (text) - Código de referencia para identificar el plan

  2. Notes
    - `billing_day` is nullable, allowing plans without a specific billing day
    - `external_reference` is nullable and can be used to identify plans in external systems
    - Values are stored and sent to MercadoPago when creating subscription plans
*/

-- Add billing_day column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plans' AND column_name = 'billing_day'
  ) THEN
    ALTER TABLE plans ADD COLUMN billing_day integer;
    COMMENT ON COLUMN plans.billing_day IS 'Día del mes para facturación (1-31)';
  END IF;
END $$;

-- Add external_reference column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plans' AND column_name = 'external_reference'
  ) THEN
    ALTER TABLE plans ADD COLUMN external_reference text;
    COMMENT ON COLUMN plans.external_reference IS 'Código de referencia para identificar el plan';
  END IF;
END $$;

-- Add check constraint to ensure billing_day is between 1 and 31
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'plans_billing_day_check'
  ) THEN
    ALTER TABLE plans ADD CONSTRAINT plans_billing_day_check 
      CHECK (billing_day IS NULL OR (billing_day >= 1 AND billing_day <= 31));
  END IF;
END $$;