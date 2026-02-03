import { useState, useEffect } from 'react';

interface PaymentStatus {
  hasPaymentMethod: boolean;
  subscription: {
    id: string;
    status: string;
    plan_name: string;
    trial_end: string | null;
    days_until_trial_end: number;
    payment_provider: string | null;
  } | null;
  loading: boolean;
  error: string | null;
}

export function usePaymentStatus(externalUserId: string | null, externalAppId: string | null) {
  const [status, setStatus] = useState<PaymentStatus>({
    hasPaymentMethod: false,
    subscription: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!externalUserId || !externalAppId) {
      setStatus({
        hasPaymentMethod: false,
        subscription: null,
        loading: false,
        error: null,
      });
      return;
    }

    const checkPaymentStatus = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const response = await fetch(
          `${supabaseUrl}/functions/v1/recurring-subscriptions/subscription-status?external_user_id=${encodeURIComponent(externalUserId)}&external_app_id=${encodeURIComponent(externalAppId)}`,
          {
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'apikey': supabaseKey,
            },
          }
        );

        const data = await response.json();

        if (response.ok && data.success) {
          setStatus({
            hasPaymentMethod: data.has_payment_method,
            subscription: data.subscription,
            loading: false,
            error: null,
          });
        } else {
          setStatus({
            hasPaymentMethod: false,
            subscription: null,
            loading: false,
            error: data.error || 'Failed to check payment status',
          });
        }
      } catch (err) {
        console.error('Error checking payment status:', err);
        setStatus({
          hasPaymentMethod: false,
          subscription: null,
          loading: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    };

    checkPaymentStatus();
  }, [externalUserId, externalAppId]);

  return status;
}
