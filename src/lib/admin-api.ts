import { ConfigService } from './config';

const getAdminApiUrl = () => {
  const supabaseUrl = ConfigService.getVariable('VITE_SUPABASE_URL');
  return `${supabaseUrl}/functions/v1/admin-api`;
};

interface License {
  id: string;
  jti: string;
  tenant_id: string;
  subscription_id: string;
  type: 'trial' | 'paid' | 'lifetime' | 'promotional';
  status: 'active' | 'expired' | 'revoked' | 'suspended';
  issued_at: string;
  expires_at: string;
  last_validated_at?: string;
  entitlements: any;
}

interface Subscription {
  id: string;
  status: string;
  plan_name?: string;
  plan_price?: number;
  plan_currency?: string;
  trial_start?: string;
  trial_end?: string;
  period_start: string;
  period_end: string;
  plan?: any;
}

interface ApplicationUser {
  id: string;
  external_user_id: string;
  email: string;
  name: string;
  status: string;
  last_login?: string;
  created_at: string;
  tenant?: {
    id: string;
    name: string;
    status: string;
  };
  subscription?: Subscription;
  license?: License;
}

interface Application {
  id: string;
  name: string;
  slug: string;
  external_app_id: string;
  api_key: string;
  webhook_url?: string;
  settings: Record<string, any>;
  is_active: boolean;
  plan_id?: string;
  max_users?: number;
  created_at: string;
  updated_at: string;
  users_count?: number;
  plans_count?: number;
}

interface Tenant {
  id: string;
  name: string;
  organization_name: string;
  owner_user_id: string;
  owner_email: string;
  billing_email?: string;
  domain?: string;
  tax_id?: string;
  status: 'active' | 'suspended' | 'canceled';
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  tenant_applications?: TenantApplication[];
}

interface TenantApplication {
  id: string;
  tenant_id: string;
  application_id: string;
  subscription_id?: string;
  status: 'active' | 'suspended' | 'canceled';
  granted_at: string;
  granted_by: string;
  notes?: string;
  application?: Application;
  subscription?: any;
}

interface Plan {
  id: string;
  application_id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  billing_cycle: 'monthly' | 'annual';
  trial_days?: number;
  entitlements: any;
  mp_preapproval_plan_id?: string;
  mp_status?: string;
  mp_init_point?: string;
  mp_back_url?: string;
  mp_collector_id?: number;
  mp_application_id?: number;
  mp_date_created?: string;
  mp_last_modified?: string;
  mp_response?: any;
}

interface AuditLog {
  id: string;
  admin_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  changes: any;
  ip_address: string;
  user_agent: string;
  created_at: string;
  admin_user?: {
    name: string;
    email: string;
  };
}

interface DashboardStats {
  tenants_count: number;
  active_subscriptions: number;
  applications_count: number;
  recent_tenants: Tenant[];
}

interface FeatureCatalog {
  id: string;
  code: string;
  name: string;
  description: string;
  value_type: 'number' | 'boolean' | 'text';
  default_value: string;
  category: string;
  unit?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

class AdminAPIService {
  private adminToken: string;

  constructor(adminToken: string) {
    this.adminToken = adminToken;
  }

  private get headers(): HeadersInit {
    const supabaseAnonKey = ConfigService.getVariable('VITE_SUPABASE_ANON_KEY');
    return {
      'Content-Type': 'application/json',
      'X-Admin-Token': this.adminToken,
      'Authorization': `Bearer ${supabaseAnonKey}`,
    };
  }

  async getApplications(): Promise<Application[]> {
    const response = await fetch(`${getAdminApiUrl()}/applications`, {
      headers: this.headers,
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch applications');
    }

    return result.data;
  }

  async createApplication(data: {
    name: string;
    slug: string;
    external_app_id: string;
    webhook_url?: string;
    settings?: Record<string, any>;
  }): Promise<Application> {
    const response = await fetch(`${getAdminApiUrl()}/applications`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to create application');
    }

    return result.data;
  }

  async getTenants(): Promise<Tenant[]> {
    const response = await fetch(`${getAdminApiUrl()}/tenants`, {
      headers: this.headers,
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch tenants');
    }

    return result.data;
  }

  async getTenant(tenantId: string): Promise<Tenant> {
    const response = await fetch(`${getAdminApiUrl()}/tenants/${tenantId}`, {
      headers: this.headers,
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch tenant');
    }

    return result.data;
  }

  async createTenant(data: {
    name: string;
    organization_name?: string;
    owner_user_id: string;
    owner_email: string;
    billing_email?: string;
    domain?: string;
    tax_id?: string;
    metadata?: Record<string, any>;
  }): Promise<Tenant> {
    const response = await fetch(`${getAdminApiUrl()}/tenants`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (!result.success) {
      const errorMsg = result.error || 'Failed to create tenant';
      const details = result.details || '';
      console.error('Create tenant error details:', { error: errorMsg, details, result });
      throw new Error(`${errorMsg}${details ? `\n${details}` : ''}`);
    }

    return result.data;
  }

  async grantAccess(
    tenantId: string,
    data: {
      application_id: string;
      plan_id?: string;
      start_trial?: boolean;
      notes?: string;
    }
  ): Promise<TenantApplication> {
    const response = await fetch(`${getAdminApiUrl()}/tenants/${tenantId}/grant-access`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to grant access');
    }

    return result.data;
  }

  async revokeAccess(tenantId: string, applicationId: string): Promise<TenantApplication> {
    const response = await fetch(
      `${getAdminApiUrl()}/tenants/${tenantId}/revoke-access/${applicationId}`,
      {
        method: 'PUT',
        headers: this.headers,
      }
    );

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to revoke access');
    }

    return result.data;
  }

  async changePlan(subscriptionId: string, planId: string): Promise<any> {
    const response = await fetch(`${getAdminApiUrl()}/subscriptions/${subscriptionId}/change-plan`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify({ plan_id: planId }),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to change plan');
    }

    return result.data;
  }

  async changeSubscriptionStatus(
    subscriptionId: string,
    status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'
  ): Promise<any> {
    const response = await fetch(`${getAdminApiUrl()}/subscriptions/${subscriptionId}/status`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify({ status }),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to change status');
    }

    return result.data;
  }

  async getAuditLog(limit = 50, offset = 0): Promise<AuditLog[]> {
    const response = await fetch(`${getAdminApiUrl()}/audit-log?limit=${limit}&offset=${offset}`, {
      headers: this.headers,
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch audit log');
    }

    return result.data;
  }

  async getStats(): Promise<DashboardStats> {
    const response = await fetch(`${getAdminApiUrl()}/stats`, {
      headers: this.headers,
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch stats');
    }

    return result.data;
  }

  async getPlans(applicationId?: string): Promise<Plan[]> {
    const url = applicationId
      ? `${getAdminApiUrl()}/plans?application_id=${applicationId}`
      : `${getAdminApiUrl()}/plans`;

    const response = await fetch(url, {
      headers: this.headers,
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch plans');
    }

    return result.data;
  }

  async createPlan(data: {
    application_id: string;
    name: string;
    description?: string;
    price: number;
    currency: string;
    billing_cycle: 'monthly' | 'annual';
    trial_days?: number;
    entitlements?: any;
  }): Promise<Plan> {
    const response = await fetch(`${getAdminApiUrl()}/plans`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to create plan');
    }

    return result.data;
  }

  async updatePlan(planId: string, data: any): Promise<Plan> {
    const response = await fetch(`${getAdminApiUrl()}/plans/${planId}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to update plan');
    }

    return result.data;
  }

  async deletePlan(planId: string): Promise<void> {
    const response = await fetch(`${getAdminApiUrl()}/plans/${planId}`, {
      method: 'DELETE',
      headers: this.headers,
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete plan');
    }
  }

  async updateApplication(applicationId: string, data: {
    name?: string;
    webhook_url?: string;
    settings?: Record<string, any>;
    is_active?: boolean;
  }): Promise<Application> {
    const response = await fetch(`${getAdminApiUrl()}/applications/${applicationId}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to update application');
    }

    return result.data;
  }

  async deleteApplication(applicationId: string): Promise<void> {
    const response = await fetch(`${getAdminApiUrl()}/applications/${applicationId}`, {
      method: 'DELETE',
      headers: this.headers,
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete application');
    }
  }

  async updateTenant(tenantId: string, data: {
    name?: string;
    organization_name?: string;
    billing_email?: string;
    domain?: string;
    tax_id?: string;
    status?: 'active' | 'suspended' | 'canceled';
    metadata?: Record<string, any>;
  }): Promise<Tenant> {
    const response = await fetch(`${getAdminApiUrl()}/tenants/${tenantId}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to update tenant');
    }

    return result.data;
  }

  async getApplicationUsers(applicationId: string): Promise<ApplicationUser[]> {
    const response = await fetch(`${getAdminApiUrl()}/applications/${applicationId}/users`, {
      headers: this.headers,
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch application users');
    }

    return result.data;
  }

  async assignPlanToApplication(applicationId: string, planId: string): Promise<Application> {
    const response = await fetch(`${getAdminApiUrl()}/applications/${applicationId}/assign-plan`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify({ plan_id: planId }),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to assign plan to application');
    }

    return result.data;
  }

  async assignExistingPlanToApplication(planId: string, applicationId: string): Promise<Plan> {
    const response = await fetch(`${getAdminApiUrl()}/plans/${planId}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify({ application_id: applicationId }),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to assign plan to application');
    }

    return result.data;
  }

  async assignPlanToUser(externalUserId: string, planId: string, applicationId: string): Promise<any> {
    const response = await fetch(`${getAdminApiUrl()}/users/assign-plan`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        external_user_id: externalUserId,
        plan_id: planId,
        application_id: applicationId
      }),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to assign plan to user');
    }

    return result.data;
  }

  async getFeatureCatalog(search?: string, category?: string): Promise<FeatureCatalog[]> {
    let url = `${getAdminApiUrl()}/features`;
    const params = new URLSearchParams();

    if (search) params.append('search', search);
    if (category) params.append('category', category);

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await fetch(url, {
      headers: this.headers,
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch feature catalog');
    }

    return result.data;
  }

  async createFeature(data: {
    name: string;
    code: string;
    description?: string;
    value_type?: string;
    category?: string;
    default_value?: string;
    unit?: string;
    active?: boolean;
  }): Promise<FeatureCatalog> {
    const response = await fetch(`${getAdminApiUrl()}/features`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to create feature');
    }

    return result.data;
  }

  async syncPlanWithMercadoPago(planId: string): Promise<Plan> {
    const response = await fetch(`${getAdminApiUrl()}/plans/${planId}/sync-mercadopago`, {
      method: 'POST',
      headers: this.headers,
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to sync plan with MercadoPago');
    }

    return result.data;
  }
}

export { AdminAPIService };
export type { Application, ApplicationUser, Tenant, TenantApplication, Plan, AuditLog, DashboardStats, License, Subscription, FeatureCatalog };
