/*
  # Add application_id to plans table
  
  1. Changes
    - Add application_id column to plans table
    - Plans can now be specific to applications
    - Remove unique constraint on name to allow same plan name for different apps
*/

-- Add application_id to plans
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'application_id') THEN
    ALTER TABLE plans ADD COLUMN application_id uuid REFERENCES applications(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop unique constraint on name if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'plans' AND constraint_name = 'plans_name_key'
  ) THEN
    ALTER TABLE plans DROP CONSTRAINT plans_name_key;
  END IF;
END $$;

-- Add unique constraint on (name, application_id) combination
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'plans' AND constraint_name = 'plans_name_application_id_key'
  ) THEN
    ALTER TABLE plans ADD CONSTRAINT plans_name_application_id_key UNIQUE (name, application_id);
  END IF;
END $$;

-- Create index on application_id
CREATE INDEX IF NOT EXISTS idx_plans_application_id ON plans(application_id);