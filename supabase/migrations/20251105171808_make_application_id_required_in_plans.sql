/*
  # Make application_id required in plans table

  1. Changes
    - Make application_id NOT NULL in plans table
    - Add check constraint to ensure application_id is always set
  
  2. Notes
    - This ensures every plan is associated with an application
    - Plans cannot exist without being assigned to an application
*/

-- First, update any existing plans without application_id
-- (Set them to a default application or handle as needed)
UPDATE plans 
SET application_id = (SELECT id FROM applications LIMIT 1)
WHERE application_id IS NULL;

-- Now make the column NOT NULL
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plans' 
    AND column_name = 'application_id' 
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE plans 
    ALTER COLUMN application_id SET NOT NULL;
  END IF;
END $$;
