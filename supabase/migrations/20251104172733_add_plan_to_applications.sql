/*
  # Add Plan Assignment to Applications

  ## Changes
  - Add `plan_id` column to applications table
  - Add foreign key constraint to plans table
  - Add `max_users` field to applications for tracking user limits based on plan

  ## Purpose
  This migration transforms the system so that applications (not individual users) 
  are the main tenants. Each application can have a plan assigned with user limits.
*/

-- Add plan_id to applications table
ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES plans(id) ON DELETE SET NULL;

-- Add max_users field for easy access to plan limits
ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS max_users integer DEFAULT 0;

-- Create index for faster plan lookups
CREATE INDEX IF NOT EXISTS idx_applications_plan_id ON applications(plan_id);

-- Add comment for clarity
COMMENT ON COLUMN applications.plan_id IS 'Plan assigned to this application (tenant)';
COMMENT ON COLUMN applications.max_users IS 'Maximum users allowed based on plan';
