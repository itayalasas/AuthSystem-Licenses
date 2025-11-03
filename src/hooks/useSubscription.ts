import { useState, useEffect, useCallback } from 'react';
import { subscriptionService, type Tenant, type Subscription, type License } from '../lib/subscription';

interface SubscriptionState {
  tenant: Tenant | null;
  subscription: Subscription | null;
  license: License | null;
  loading: boolean;
  error: string | null;
}

export function useSubscription(appId: string | null) {
  const [state, setState] = useState<SubscriptionState>({
    tenant: null,
    subscription: null,
    license: null,
    loading: true,
    error: null,
  });

  const loadSubscriptionData = useCallback(async () => {
    if (!appId) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const tenant = await subscriptionService.getTenantByAppId(appId);
      const subscription = tenant.subscriptions?.[0] || null;

      let license = null;
      if (subscription) {
        try {
          const licenseData = await subscriptionService.issueLicense(tenant.id);
          license = licenseData.license;
        } catch (error) {
          console.error('Failed to issue license:', error);
        }
      }

      setState({
        tenant,
        subscription,
        license,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState({
        tenant: null,
        subscription: null,
        license: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load subscription data',
      });
    }
  }, [appId]);

  useEffect(() => {
    loadSubscriptionData();
  }, [loadSubscriptionData]);

  const refresh = useCallback(() => {
    return loadSubscriptionData();
  }, [loadSubscriptionData]);

  return {
    ...state,
    refresh,
    isTrialing: state.subscription?.status === 'trialing',
    isActive: state.subscription?.status === 'active',
    isPastDue: state.subscription?.status === 'past_due',
    isCanceled: state.subscription?.status === 'canceled',
    isPaused: state.subscription?.status === 'paused',
    daysRemaining: state.subscription
      ? subscriptionService.getDaysUntilExpiry(state.subscription)
      : 0,
  };
}
