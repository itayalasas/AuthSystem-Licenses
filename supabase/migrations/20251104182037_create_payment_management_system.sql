/*
  # Sistema de Gestión de Pagos y Períodos de Prueba

  ## Descripción General
  Implementa un sistema completo para gestionar pagos de suscripciones, incluyendo:
  - Registro detallado de transacciones de pago
  - Control automático de períodos de prueba
  - Transiciones automáticas de estado de suscripción
  - Historial de cambios de estado
  - Integración con múltiples proveedores de pago

  ## Nuevas Tablas

  ### 1. `subscription_payments`
  Registra todos los pagos realizados para las suscripciones
  - `id` (uuid, PK): Identificador único del pago
  - `subscription_id` (uuid, FK): Referencia a la suscripción
  - `tenant_id` (uuid, FK): Referencia al tenant
  - `plan_id` (uuid, FK): Plan asociado al pago
  - `amount` (numeric): Monto del pago
  - `currency` (text): Moneda del pago
  - `status` (text): Estado del pago (pending, completed, failed, refunded)
  - `payment_method` (text): Método de pago usado
  - `payment_provider` (text): Proveedor de pago (mercadopago, dlocal, stripe)
  - `provider_transaction_id` (text): ID de transacción del proveedor
  - `provider_customer_id` (text): ID del cliente en el proveedor
  - `period_start` (timestamptz): Inicio del período pagado
  - `period_end` (timestamptz): Fin del período pagado
  - `paid_at` (timestamptz): Fecha de pago exitoso
  - `failed_at` (timestamptz): Fecha de fallo (si aplica)
  - `refunded_at` (timestamptz): Fecha de reembolso (si aplica)
  - `failure_reason` (text): Razón del fallo
  - `metadata` (jsonb): Datos adicionales del pago
  - `created_at` (timestamptz): Fecha de creación
  - `updated_at` (timestamptz): Fecha de actualización

  ### 2. `subscription_status_history`
  Mantiene un historial de todos los cambios de estado de las suscripciones
  - `id` (uuid, PK): Identificador único
  - `subscription_id` (uuid, FK): Referencia a la suscripción
  - `from_status` (text): Estado anterior
  - `to_status` (text): Nuevo estado
  - `reason` (text): Razón del cambio
  - `changed_by` (text): Quien realizó el cambio (system, admin, user)
  - `metadata` (jsonb): Datos adicionales del cambio
  - `created_at` (timestamptz): Fecha del cambio

  ## Funciones y Triggers

  ### 1. `check_trial_expiration()`
  Verifica y actualiza automáticamente las suscripciones cuando expira el período de prueba
  - Cambia estado de 'trialing' a 'past_due' si no hay pago registrado
  - Registra el cambio en el historial

  ### 2. `check_subscription_renewal()`
  Verifica y gestiona la renovación de suscripciones activas
  - Cambia estado a 'past_due' si el período actual expiró sin pago
  - Permite gracia de 3 días antes de suspender

  ### 3. `process_successful_payment()`
  Procesa pagos exitosos y actualiza el estado de la suscripción
  - Activa suscripciones en 'past_due' o 'trialing'
  - Extiende el período de suscripción según el plan
  - Registra el cambio en el historial

  ### 4. `record_subscription_status_change()`
  Trigger que registra automáticamente cambios de estado en el historial

  ## Índices
  - Búsquedas por suscripción, tenant, estado de pago
  - Búsquedas por fechas de pago y período
  - Búsquedas por proveedor y transacción
  - Historial de suscripciones

  ## Seguridad (RLS)
  - Service role tiene acceso completo
  - Las aplicaciones pueden consultar sus propios pagos vía API
*/

-- Create subscription_payments table
CREATE TABLE IF NOT EXISTS subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  plan_id uuid REFERENCES plans(id) NOT NULL,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded')),
  payment_method text,
  payment_provider text CHECK (payment_provider IN ('mercadopago', 'dlocal', 'stripe', 'manual')),
  provider_transaction_id text,
  provider_customer_id text,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  paid_at timestamptz,
  failed_at timestamptz,
  refunded_at timestamptz,
  refund_amount numeric(10,2),
  failure_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subscription_status_history table
CREATE TABLE IF NOT EXISTS subscription_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE NOT NULL,
  from_status text,
  to_status text NOT NULL,
  reason text,
  changed_by text NOT NULL DEFAULT 'system',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for subscription_payments
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON subscription_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON subscription_payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_period_end ON subscription_payments(period_end);
CREATE INDEX IF NOT EXISTS idx_payments_provider_transaction ON subscription_payments(payment_provider, provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON subscription_payments(created_at);

-- Create indexes for subscription_status_history
CREATE INDEX IF NOT EXISTS idx_status_history_subscription_id ON subscription_status_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_status_history_created_at ON subscription_status_history(created_at);

-- Enable RLS
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Service role can manage all payments"
  ON subscription_payments FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can view all status history"
  ON subscription_status_history FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Trigger for updated_at on payments
CREATE TRIGGER update_subscription_payments_updated_at BEFORE UPDATE ON subscription_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to record subscription status changes
CREATE OR REPLACE FUNCTION record_subscription_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO subscription_status_history (
      subscription_id,
      from_status,
      to_status,
      reason,
      changed_by,
      metadata
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      COALESCE(NEW.metadata->>'status_change_reason', 'Status updated'),
      COALESCE(NEW.metadata->>'changed_by', 'system'),
      jsonb_build_object(
        'trial_end', NEW.trial_end,
        'period_end', NEW.period_end,
        'timestamp', now()
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to record status changes
DROP TRIGGER IF EXISTS record_subscription_status_change_trigger ON subscriptions;
CREATE TRIGGER record_subscription_status_change_trigger
  AFTER UPDATE ON subscriptions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION record_subscription_status_change();

-- Function to check and update trial expirations
CREATE OR REPLACE FUNCTION check_trial_expiration()
RETURNS void AS $$
DECLARE
  expired_subscription RECORD;
BEGIN
  FOR expired_subscription IN
    SELECT s.id, s.tenant_id, s.plan_id, s.trial_end
    FROM subscriptions s
    WHERE s.status = 'trialing'
      AND s.trial_end < now()
      AND NOT EXISTS (
        SELECT 1 FROM subscription_payments sp
        WHERE sp.subscription_id = s.id
          AND sp.status = 'completed'
          AND sp.period_start >= s.trial_start
      )
  LOOP
    UPDATE subscriptions
    SET 
      status = 'past_due',
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{status_change_reason}',
        '"Trial period expired without payment"'
      )
    WHERE id = expired_subscription.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to check subscription renewal and expiration
CREATE OR REPLACE FUNCTION check_subscription_renewal()
RETURNS void AS $$
DECLARE
  expired_subscription RECORD;
  grace_period_days integer := 3;
BEGIN
  FOR expired_subscription IN
    SELECT 
      s.id, 
      s.tenant_id, 
      s.plan_id, 
      s.current_period_end,
      s.status
    FROM subscriptions s
    WHERE s.status IN ('active', 'past_due')
      AND s.current_period_end < now()
      AND NOT EXISTS (
        SELECT 1 FROM subscription_payments sp
        WHERE sp.subscription_id = s.id
          AND sp.status = 'completed'
          AND sp.period_start >= s.current_period_end
      )
  LOOP
    IF expired_subscription.current_period_end < (now() - (grace_period_days || ' days')::interval) THEN
      UPDATE subscriptions
      SET 
        status = 'expired',
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{status_change_reason}',
          '"Subscription expired - no payment received within grace period"'
        )
      WHERE id = expired_subscription.id;
    ELSIF expired_subscription.status = 'active' THEN
      UPDATE subscriptions
      SET 
        status = 'past_due',
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{status_change_reason}',
          '"Subscription period ended - payment required"'
        )
      WHERE id = expired_subscription.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to process successful payment
CREATE OR REPLACE FUNCTION process_successful_payment(payment_id uuid)
RETURNS void AS $$
DECLARE
  payment RECORD;
  subscription RECORD;
  plan RECORD;
  new_period_end timestamptz;
BEGIN
  SELECT * INTO payment FROM subscription_payments WHERE id = payment_id;
  
  IF NOT FOUND OR payment.status != 'completed' THEN
    RAISE EXCEPTION 'Payment not found or not completed';
  END IF;

  SELECT * INTO subscription FROM subscriptions WHERE id = payment.subscription_id;
  SELECT * INTO plan FROM plans WHERE id = payment.plan_id;

  IF plan.billing_cycle = 'monthly' THEN
    new_period_end := payment.period_start + interval '1 month';
  ELSIF plan.billing_cycle = 'annual' THEN
    new_period_end := payment.period_start + interval '1 year';
  ELSE
    new_period_end := payment.period_start + interval '1 month';
  END IF;

  UPDATE subscriptions
  SET 
    status = 'active',
    current_period_start = payment.period_start,
    current_period_end = new_period_end,
    period_start = payment.period_start,
    period_end = new_period_end,
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{status_change_reason}',
      '"Payment processed successfully"'
    ),
    metadata = jsonb_set(
      metadata,
      '{last_payment_id}',
      to_jsonb(payment_id::text)
    )
  WHERE id = payment.subscription_id;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically transition from trial to paid
CREATE OR REPLACE FUNCTION auto_activate_subscription_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  subscription RECORD;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT * INTO subscription FROM subscriptions WHERE id = NEW.subscription_id;
    
    IF subscription.status IN ('trialing', 'past_due') THEN
      PERFORM process_successful_payment(NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-activate on payment
DROP TRIGGER IF EXISTS auto_activate_subscription_on_payment_trigger ON subscription_payments;
CREATE TRIGGER auto_activate_subscription_on_payment_trigger
  AFTER INSERT OR UPDATE ON subscription_payments
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION auto_activate_subscription_on_payment();

-- Add helpful view for payment summaries
CREATE OR REPLACE VIEW subscription_payment_summary AS
SELECT 
  s.id as subscription_id,
  s.tenant_id,
  t.name as tenant_name,
  s.plan_id,
  p.name as plan_name,
  s.status as subscription_status,
  COUNT(sp.id) as total_payments,
  COUNT(sp.id) FILTER (WHERE sp.status = 'completed') as successful_payments,
  COUNT(sp.id) FILTER (WHERE sp.status = 'failed') as failed_payments,
  SUM(sp.amount) FILTER (WHERE sp.status = 'completed') as total_paid,
  MAX(sp.paid_at) as last_payment_date,
  MAX(sp.period_end) as last_paid_period_end
FROM subscriptions s
LEFT JOIN subscription_payments sp ON sp.subscription_id = s.id
LEFT JOIN tenants t ON t.id = s.tenant_id
LEFT JOIN plans p ON p.id = s.plan_id
GROUP BY s.id, s.tenant_id, t.name, s.plan_id, p.name, s.status;
