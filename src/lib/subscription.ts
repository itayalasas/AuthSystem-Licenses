import { ConfigService } from './config';

const getSubscriptionApiUrl = () => {
  const supabaseUrl = ConfigService.getVariable('VITE_SUPABASE_URL');
  return `${supabaseUrl}/functions/v1/subscription-manager`;
};

interface AuthData {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    permissions: Record<string, string[]>;
  };
  application: {
    id: string;
    name: string;
    domain: string;
  };
}

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  billing_cycle: 'monthly' | 'annual';
  trial_days: number;
  entitlements: {
    max_users: number;
    features: {
      advanced_reports: boolean;
      api_access: boolean;
      priority_support: boolean;
    };
    limits: {
      storage_gb: number;
      monthly_emails: number;
    };
  };
  is_active: boolean;
  sort_order: number;
}

interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused';
  period_start: string;
  period_end: string;
  trial_start?: string;
  trial_end?: string;
  plan: Plan;
}

interface Tenant {
  id: string;
  external_app_id: string;
  name: string;
  owner_user_id: string;
  owner_email: string;
  domain?: string;
  subscriptions?: Subscription[];
}

interface License {
  id: string;
  tenant_id: string;
  jti: string;
  type: 'trial' | 'paid';
  status: 'active' | 'revoked' | 'expired';
  issued_at: string;
  expires_at: string;
  entitlements: Plan['entitlements'];
}

class SubscriptionService {
  private headers: HeadersInit;

  constructor() {
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    };
  }

  async getPlans(): Promise<Plan[]> {
    const response = await fetch(`${getSubscriptionApiUrl()}/plans`, {
      headers: this.headers,
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch plans');
    }

    return result.data;
  }

  async createOrGetTenant(authData: AuthData): Promise<{ tenant: Tenant; subscription: Subscription }> {
    const response = await fetch(`${getSubscriptionApiUrl()}/tenants`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        external_app_id: authData.application.id,
        name: authData.application.name,
        owner_user_id: authData.user.id,
        owner_email: authData.user.email,
        domain: authData.application.domain,
      }),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to create tenant');
    }

    return result.data;
  }

  async getTenantByAppId(appId: string): Promise<Tenant> {
    const response = await fetch(`${getSubscriptionApiUrl()}/tenants/${appId}`, {
      headers: this.headers,
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch tenant');
    }

    return result.data;
  }

  async issueLicense(tenantId: string): Promise<{ license: License; subscription: Subscription; entitlements: Plan['entitlements'] }> {
    const response = await fetch(`${getSubscriptionApiUrl()}/licenses/issue`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ tenant_id: tenantId }),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to issue license');
    }

    return result.data;
  }

  async validateLicense(jti: string): Promise<{ valid: boolean; data?: License }> {
    const response = await fetch(`${getSubscriptionApiUrl()}/licenses/validate`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ jti }),
    });

    const result = await response.json();
    return result;
  }

  async upgradeSubscription(
    tenantId: string,
    planId: string,
    paymentProvider: 'mercadopago' | 'dlocal' | 'stripe',
    providerSubscriptionId: string,
    providerCustomerId: string
  ): Promise<Subscription> {
    const response = await fetch(`${getSubscriptionApiUrl()}/subscriptions/upgrade`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify({
        tenant_id: tenantId,
        plan_id: planId,
        payment_provider: paymentProvider,
        provider_subscription_id: providerSubscriptionId,
        provider_customer_id: providerCustomerId,
      }),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to upgrade subscription');
    }

    return result.data;
  }

  getDaysUntilExpiry(subscription: Subscription): number {
    const endDate = subscription.status === 'trialing' && subscription.trial_end
      ? new Date(subscription.trial_end)
      : new Date(subscription.period_end);

    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  canAccessFeature(entitlements: Plan['entitlements'], feature: keyof Plan['entitlements']['features']): boolean {
    return entitlements.features[feature] === true;
  }

  isWithinLimit(entitlements: Plan['entitlements'], metric: keyof Plan['entitlements']['limits'], currentValue: number): boolean {
    const limit = entitlements.limits[metric];
    return currentValue < limit;
  }
}

export const subscriptionService = new SubscriptionService();
export type { Plan, Subscription, Tenant, License, AuthData };
