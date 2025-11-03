/*
  # Fix tenants table - Make external_app_id nullable

  1. Changes
    - Make `external_app_id` column nullable in `tenants` table
    - This allows creating tenants without requiring an external app ID
  
  2. Reasoning
    - Not all tenants need to be linked to an external app immediately
    - Admins should be able to create tenants first, then link apps later
*/

ALTER TABLE tenants 
ALTER COLUMN external_app_id DROP NOT NULL;
