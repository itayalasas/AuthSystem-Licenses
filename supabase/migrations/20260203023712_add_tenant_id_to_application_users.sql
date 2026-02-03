/*
  # Add tenant_id to application_users table

  1. Changes
    - Add `tenant_id` column to `application_users` table
    - Add foreign key constraint to `tenants` table
    - Create index for better query performance
  
  2. Notes
    - This column links application users to their parent tenant
    - Nullable initially to allow existing data migration
*/

-- Add tenant_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'application_users' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE application_users ADD COLUMN tenant_id uuid;
    
    -- Add foreign key constraint
    ALTER TABLE application_users 
      ADD CONSTRAINT fk_application_users_tenant 
      FOREIGN KEY (tenant_id) 
      REFERENCES tenants(id) 
      ON DELETE CASCADE;
    
    -- Create index for performance
    CREATE INDEX IF NOT EXISTS idx_application_users_tenant_id 
      ON application_users(tenant_id);
  END IF;
END $$;
