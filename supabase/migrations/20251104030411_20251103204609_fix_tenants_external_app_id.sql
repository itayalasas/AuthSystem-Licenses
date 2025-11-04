/*
  # Fix tenants table - Make external_app_id nullable
*/

ALTER TABLE tenants 
ALTER COLUMN external_app_id DROP NOT NULL;