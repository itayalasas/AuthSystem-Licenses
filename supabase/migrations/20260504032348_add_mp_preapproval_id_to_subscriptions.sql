/*
  # Add mp_preapproval_id to subscriptions

  Adds a dedicated column for MercadoPago preapproval IDs so the subscription-callback
  and webhook-handler can look up subscriptions by the MP preapproval ID without
  conflating it with the generic provider_subscription_id field.

  1. Changes
    - `subscriptions`: add `mp_preapproval_id` text column (nullable, indexed)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'mp_preapproval_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN mp_preapproval_id text;
    CREATE INDEX IF NOT EXISTS idx_subscriptions_mp_preapproval_id ON subscriptions(mp_preapproval_id);
  END IF;
END $$;

-- Backfill: copy provider_subscription_id into mp_preapproval_id for existing MP subscriptions
UPDATE subscriptions
SET mp_preapproval_id = provider_subscription_id
WHERE payment_provider = 'mercadopago'
  AND provider_subscription_id IS NOT NULL
  AND mp_preapproval_id IS NULL;
