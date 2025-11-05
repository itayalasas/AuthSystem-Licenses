/*
  # Actualizar trigger de licencia de prueba para incluir plan_id

  ## Descripción
  Actualiza la función `auto_assign_trial_license()` para incluir el campo
  `plan_id` al crear licencias automáticamente. Esto corrige el error
  de columna faltante durante la sincronización de usuarios.

  ## Cambios
  1. Modifica el INSERT de licenses para incluir plan_id
  2. El plan_id se toma del v_plan_id que ya se calcula en la función

  ## Notas
  - Mantiene toda la funcionalidad existente
  - Solo agrega el campo plan_id al INSERT
*/

-- Actualizar función para incluir plan_id
CREATE OR REPLACE FUNCTION auto_assign_trial_license()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id uuid;
  v_subscription_id uuid;
  v_plan_id uuid;
  v_plan_record record;
  v_trial_days integer;
  v_period_end timestamptz;
  v_trial_end timestamptz;
  v_license_expires_at timestamptz;
  v_jti uuid;
BEGIN
  -- Solo procesar usuarios activos en su primera inserción
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- Verificar si el usuario ya tiene un tenant asociado a esta aplicación
  SELECT t.id INTO v_tenant_id
  FROM tenants t
  INNER JOIN tenant_applications ta ON ta.tenant_id = t.id
  WHERE t.owner_user_id = NEW.external_user_id
    AND ta.application_id = NEW.application_id
  LIMIT 1;

  -- Si el usuario ya tiene un tenant, no hacer nada
  IF v_tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Crear un nuevo tenant para el usuario
  INSERT INTO tenants (
    name,
    organization_name,
    owner_user_id,
    owner_email,
    billing_email,
    domain,
    status,
    metadata
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

  -- Buscar un plan de prueba (primero "Starter", luego cualquier plan activo)
  SELECT id, trial_days, billing_cycle, entitlements INTO v_plan_record
  FROM plans
  WHERE is_active = true
    AND (application_id IS NULL OR application_id = NEW.application_id)
    AND name = 'Starter'
  LIMIT 1;

  -- Si no hay plan Starter, tomar el primer plan activo disponible
  IF v_plan_record IS NULL THEN
    SELECT id, trial_days, billing_cycle, entitlements INTO v_plan_record
    FROM plans
    WHERE is_active = true
      AND (application_id IS NULL OR application_id = NEW.application_id)
    ORDER BY sort_order ASC, price ASC
    LIMIT 1;
  END IF;

  -- Si hay un plan disponible, crear la suscripción
  IF v_plan_record IS NOT NULL THEN
    v_plan_id := v_plan_record.id;
    v_trial_days := COALESCE(v_plan_record.trial_days, 14);
    
    -- Calcular fechas
    v_trial_end := now() + (v_trial_days || ' days')::interval;
    v_period_end := CASE 
      WHEN v_plan_record.billing_cycle = 'annual' THEN now() + interval '365 days'
      ELSE now() + interval '30 days'
    END;

    -- Crear la suscripción
    INSERT INTO subscriptions (
      tenant_id,
      plan_id,
      application_id,
      status,
      period_start,
      period_end,
      trial_start,
      trial_end
    )
    VALUES (
      v_tenant_id,
      v_plan_id,
      NEW.application_id,
      'trialing',
      now(),
      v_period_end,
      now(),
      v_trial_end
    )
    RETURNING id INTO v_subscription_id;

    -- Crear la relación tenant-application
    INSERT INTO tenant_applications (
      tenant_id,
      application_id,
      subscription_id,
      status,
      granted_by,
      notes
    )
    VALUES (
      v_tenant_id,
      NEW.application_id,
      v_subscription_id,
      'active',
      'system',
      'Auto-asignado durante registro de usuario'
    );

    -- Generar una licencia de prueba de 24 horas
    v_jti := gen_random_uuid();
    v_license_expires_at := now() + interval '24 hours';

    -- INSERT actualizado con application_id y plan_id
    INSERT INTO licenses (
      jti,
      tenant_id,
      subscription_id,
      application_id,
      plan_id,
      type,
      status,
      issued_at,
      expires_at,
      entitlements,
      metadata
    )
    VALUES (
      v_jti,
      v_tenant_id,
      v_subscription_id,
      NEW.application_id,
      v_plan_id,
      'trial',
      'active',
      now(),
      v_license_expires_at,
      COALESCE(v_plan_record.entitlements, '{}'::jsonb),
      jsonb_build_object(
        'auto_generated', true,
        'user_id', NEW.external_user_id,
        'user_email', NEW.email,
        'generated_at', now()
      )
    );

    -- Log del proceso
    RAISE NOTICE 'Licencia de prueba asignada automáticamente: tenant_id=%, subscription_id=%, plan_id=%, license_expires_at=%',
      v_tenant_id, v_subscription_id, v_plan_id, v_license_expires_at;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
