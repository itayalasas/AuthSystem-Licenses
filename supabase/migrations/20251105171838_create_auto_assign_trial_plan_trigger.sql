/*
  # Auto-assign trial plan when user is created in an application

  1. New Functions
    - `assign_trial_plan_to_new_user()` - Automatically assigns a trial plan when a user joins an application
  
  2. New Triggers
    - Trigger on `application_users` table to call the function after INSERT
  
  3. Logic
    - When a user is added to an application via application_users table
    - Find or create a tenant for that user
    - Find a trial plan for that application (plan with trial_days > 0)
    - Create a subscription with trial status if one doesn't exist
    - Create a license for the user
*/

-- Function to auto-assign trial plan
CREATE OR REPLACE FUNCTION assign_trial_plan_to_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id uuid;
  v_trial_plan_id uuid;
  v_trial_days integer;
  v_billing_cycle text;
  v_existing_subscription_id uuid;
  v_subscription_id uuid;
  v_now timestamptz := now();
  v_trial_end timestamptz;
  v_period_end timestamptz;
BEGIN
  -- 1. Find or create tenant for this user
  SELECT id INTO v_tenant_id
  FROM tenants
  WHERE owner_user_id = NEW.external_user_id;

  IF v_tenant_id IS NULL THEN
    -- Create a new tenant for this user
    INSERT INTO tenants (owner_user_id, name, status)
    VALUES (
      NEW.external_user_id, 
      'Tenant for ' || NEW.external_user_id, 
      'active'
    )
    RETURNING id INTO v_tenant_id;
  END IF;

  -- 2. Find a trial plan for this application
  SELECT id, trial_days, billing_cycle INTO v_trial_plan_id, v_trial_days, v_billing_cycle
  FROM plans
  WHERE application_id = NEW.application_id
    AND trial_days > 0
    AND is_active = true
  ORDER BY price ASC -- Get the cheapest trial plan
  LIMIT 1;

  -- If no trial plan exists, try to find any plan
  IF v_trial_plan_id IS NULL THEN
    SELECT id, trial_days, billing_cycle INTO v_trial_plan_id, v_trial_days, v_billing_cycle
    FROM plans
    WHERE application_id = NEW.application_id
      AND is_active = true
    ORDER BY price ASC
    LIMIT 1;
  END IF;

  -- If we found a plan, assign it
  IF v_trial_plan_id IS NOT NULL THEN
    -- Check if subscription already exists
    SELECT s.id INTO v_existing_subscription_id
    FROM subscriptions s
    JOIN tenant_applications ta ON ta.subscription_id = s.id
    WHERE ta.tenant_id = v_tenant_id
      AND ta.application_id = NEW.application_id;

    IF v_existing_subscription_id IS NULL THEN
      -- Calculate dates
      v_trial_days := COALESCE(v_trial_days, 0);
      v_trial_end := v_now + (v_trial_days || ' days')::interval;
      
      IF v_billing_cycle = 'annual' THEN
        v_period_end := v_now + interval '1 year';
      ELSE
        v_period_end := v_now + interval '1 month';
      END IF;

      -- Create subscription
      INSERT INTO subscriptions (
        tenant_id,
        plan_id,
        application_id,
        status,
        period_start,
        period_end,
        current_period_start,
        current_period_end,
        trial_start,
        trial_end
      ) VALUES (
        v_tenant_id,
        v_trial_plan_id,
        NEW.application_id,
        CASE WHEN v_trial_days > 0 THEN 'trialing' ELSE 'active' END,
        v_now,
        v_period_end,
        v_now,
        v_period_end,
        CASE WHEN v_trial_days > 0 THEN v_now ELSE NULL END,
        CASE WHEN v_trial_days > 0 THEN v_trial_end ELSE NULL END
      )
      RETURNING id INTO v_subscription_id;

      -- Create tenant_application link
      INSERT INTO tenant_applications (
        tenant_id,
        application_id,
        subscription_id
      ) VALUES (
        v_tenant_id,
        NEW.application_id,
        v_subscription_id
      )
      ON CONFLICT (tenant_id, application_id) 
      DO UPDATE SET subscription_id = v_subscription_id;

      -- Create license
      INSERT INTO licenses (
        tenant_id,
        application_id,
        plan_id,
        license_key,
        status,
        expires_at
      ) VALUES (
        v_tenant_id,
        NEW.application_id,
        v_trial_plan_id,
        'TRIAL-' || gen_random_uuid()::text,
        CASE WHEN v_trial_days > 0 THEN 'trial' ELSE 'active' END,
        CASE WHEN v_trial_days > 0 THEN v_trial_end ELSE v_period_end END
      )
      ON CONFLICT (tenant_id, application_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_assign_trial_plan ON application_users;

-- Create trigger
CREATE TRIGGER trigger_assign_trial_plan
  AFTER INSERT ON application_users
  FOR EACH ROW
  EXECUTE FUNCTION assign_trial_plan_to_new_user();
