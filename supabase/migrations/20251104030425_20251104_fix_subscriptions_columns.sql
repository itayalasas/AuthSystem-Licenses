/*
  # Fix subscriptions column names for compatibility
  
  1. Changes
    - Add current_period_start and current_period_end as aliases
    - Keep backward compatibility with period_start and period_end
*/

-- Add the new columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'current_period_start') THEN
    ALTER TABLE subscriptions ADD COLUMN current_period_start timestamptz;
    UPDATE subscriptions SET current_period_start = period_start WHERE current_period_start IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'current_period_end') THEN
    ALTER TABLE subscriptions ADD COLUMN current_period_end timestamptz;
    UPDATE subscriptions SET current_period_end = period_end WHERE current_period_end IS NULL;
  END IF;
END $$;

-- Create trigger to keep them in sync
CREATE OR REPLACE FUNCTION sync_subscription_period_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_period_start IS NOT NULL THEN
    NEW.period_start = NEW.current_period_start;
  END IF;
  IF NEW.current_period_end IS NOT NULL THEN
    NEW.period_end = NEW.current_period_end;
  END IF;
  IF NEW.period_start IS NOT NULL AND NEW.current_period_start IS NULL THEN
    NEW.current_period_start = NEW.period_start;
  END IF;
  IF NEW.period_end IS NOT NULL AND NEW.current_period_end IS NULL THEN
    NEW.current_period_end = NEW.period_end;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_subscriptions_period_columns
  BEFORE INSERT OR UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION sync_subscription_period_columns();