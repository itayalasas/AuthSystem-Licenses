/*
  # Make owner_user_id nullable in tenants table

  ## Problem
  Shared/organizational tenants synced from external apps (e.g. "Ayala it sas") have no
  individual owner — they represent companies or groups. The NOT NULL constraint on
  owner_user_id was blocking their creation during sync.

  ## Change
  - ALTER tenants.owner_user_id to allow NULL values

  ## Impact
  - Personal tenants (basic auth) still store the user's external_user_id as owner_user_id
  - Shared tenants (tenant/hybrid auth) have owner_user_id = NULL and are identified by auth_tenant_id
  - No existing data is affected
*/

ALTER TABLE tenants ALTER COLUMN owner_user_id DROP NOT NULL;
