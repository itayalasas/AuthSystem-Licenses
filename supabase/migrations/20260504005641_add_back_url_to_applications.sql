/*
  # Add back_url to applications table

  ## Purpose
  Each application can define its own back_url — the URL MercadoPago redirects to after
  a subscription checkout completes. This platform intercepts that redirect, resolves the
  subscription status from the DB, and forwards the user to the tenant's back_url with
  status query params (?subscription_id=...&status=active&plan=...).

  ## Changes
  - `applications`: new column `back_url text` — the tenant's front-end URL to receive the
    subscription result redirect. Falls back to global MERCADOPAGO_BACK_URL if null.

  ## Notes
  - Nullable: existing apps are unaffected; they continue using the global back_url.
  - No RLS changes needed; applications already has RLS configured.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'back_url'
  ) THEN
    ALTER TABLE applications ADD COLUMN back_url text;
  END IF;
END $$;
