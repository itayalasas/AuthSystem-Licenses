/*
  # Fix auto_assign_trial_license trigger

  ## Problem
  When a tenant already exists (created before application_users INSERT, e.g. via sync),
  the trigger detects the tenant and returns early WITHOUT creating the subscription.
  This leaves tenant_applications.subscription_id = null and the user sees no plan.

  ## Fix
  After finding the existing tenant, check if tenant_applications already has a subscription.
  If not, create the subscription, license, and link it — same as new tenant flow.
*/

CREATE OR REPLACE FUNCTION public.auto_assign_trial_license()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_tenant_id uuid;
  v_ta_id uuid;
  v_existing_sub_id uuid;
  v_subscription_id uuid;
  v_plan_id uuid;
  v_plan_record record;
  v_trial_days integer;
  v_period_end timestamptz;
  v_trial_end timestamptz;
  v_license_expires_at timestamptz;
  v_jti uuid;
  v_license_key text;
BEGIN
  -- Only process active users on first insert
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- Check if user already has a tenant linked to this application
  SELECT t.id, ta.id, ta.subscription_id
  INTO v_tenant_id, v_ta_id, v_existing_sub_id
  FROM tenants t
  INNER JOIN tenant_applications ta ON ta.tenant_id = t.id
  WHERE t.owner_user_id = NEW.external_user_id
    AND ta.application_id = NEW.application_id
    AND ta.status = 'active'
    AND t.auth_tenant_id IS NULL
  LIMIT 1;

  -- If tenant exists AND already has a subscription, nothing to do
  IF v_tenant_id IS NOT NULL AND v_existing_sub_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- If tenant exists but has NO subscription, create the subscription below
  -- If tenant does not exist at all, create it first
  IF v_tenant_id IS NULL THEN
    INSERT INTO tenants (
      name, organization_name, owner_user_id, owner_email,
      billing_email, domain, status, metadata
    )
    VALUES (
      NEW.name,
      NEW.name || ' Organization',
      NEW.external_user_id,
      NEW.email,
      NEW.email,
      lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substr(md5(random()::text), 1, 6) || '.netlify.app',
      'active',
      jsonb_build_object(
        'created_via', 'auto-trial-assignment',
        'auto_created_at', now(),
        'application_id', NEW.application_id
      )
    )
    RETURNING id INTO v_tenant_id;
  END IF;

  -- Find trial plan (Starter first, then any active plan for this app)
  SELECT id, trial_days, billing_cycle, entitlements INTO v_plan_record
  FROM plans
  WHERE is_active = true
    AND (application_id IS NULL OR application_id = NEW.application_id)
    AND name = 'Starter'
  LIMIT 1;

  IF v_plan_record IS NULL THEN
    SELECT id, trial_days, billing_cycle, entitlements INTO v_plan_record
    FROM plans
    WHERE is_active = true
      AND (application_id IS NULL OR application_id = NEW.application_id)
    ORDER BY sort_order ASC, price ASC
    LIMIT 1;
  END IF;

  IF v_plan_record IS NOT NULL THEN
    v_plan_id := v_plan_record.id;
    v_trial_days := COALESCE(v_plan_record.trial_days, 14);

    v_trial_end := now() + (v_trial_days || ' days')::interval;
    v_period_end := CASE
      WHEN v_plan_record.billing_cycle = 'annual' THEN now() + interval '365 days'
      ELSE now() + interval '30 days'
    END;

    -- Create subscription
    INSERT INTO subscriptions (
      tenant_id, plan_id, application_id, status,
      period_start, period_end, trial_start, trial_end
    )
    VALUES (
      v_tenant_id, v_plan_id, NEW.application_id, 'trialing',
      now(), v_period_end, now(), v_trial_end
    )
    RETURNING id INTO v_subscription_id;

    -- Create or update tenant_applications
    IF v_ta_id IS NOT NULL THEN
      -- Tenant_applications exists but has no subscription — just link it
      UPDATE tenant_applications
      SET subscription_id = v_subscription_id
      WHERE id = v_ta_id;
    ELSE
      INSERT INTO tenant_applications (
        tenant_id, application_id, subscription_id, status, granted_by, notes
      )
      VALUES (
        v_tenant_id, NEW.application_id, v_subscription_id,
        'active', 'system', 'Auto-asignado durante registro de usuario'
      );
    END IF;

    -- Create 24-hour trial license
    v_jti := gen_random_uuid();
    v_license_key := generate_license_key();
    v_license_expires_at := now() + interval '24 hours';

    INSERT INTO licenses (
      jti, license_key, tenant_id, subscription_id, application_id, plan_id,
      type, status, issued_at, expires_at, entitlements, metadata
    )
    VALUES (
      v_jti, v_license_key, v_tenant_id, v_subscription_id,
      NEW.application_id, v_plan_id,
      'trial', 'active',
      now(), v_license_expires_at,
      COALESCE(v_plan_record.entitlements, '{}'::jsonb),
      jsonb_build_object(
        'auto_generated', true,
        'user_id', NEW.external_user_id,
        'user_email', NEW.email,
        'generated_at', now()
      )
    );

    RAISE NOTICE 'Trial assigned: tenant_id=%, subscription_id=%, plan_id=%, license_key=%',
      v_tenant_id, v_subscription_id, v_plan_id, v_license_key;
  END IF;

  RETURN NEW;
END;
$function$;
