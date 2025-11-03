import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface TenantCreationPayload {
  external_app_id: string;
  name: string;
  owner_user_id: string;
  owner_email: string;
  domain?: string;
  plan_name?: string;
}

interface LicenseValidationPayload {
  tenant_id: string;
}

interface SubscriptionUpdatePayload {
  tenant_id: string;
  plan_id: string;
  payment_provider?: string;
  provider_subscription_id?: string;
  provider_customer_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const path = url.pathname.replace('/subscription-manager', '');

    // GET /plans - List all active plans
    if (path === '/plans' && req.method === 'GET') {
      const { data: plans, error } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data: plans }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /tenants - Create or get tenant and start trial
    if (path === '/tenants' && req.method === 'POST') {
      const payload: TenantCreationPayload = await req.json();

      // Check if tenant already exists
      const { data: existingTenant } = await supabase
        .from('tenants')
        .select('*, subscriptions(*, plan:plans(*))')
        .eq('external_app_id', payload.external_app_id)
        .maybeSingle();

      if (existingTenant) {
        return new Response(
          JSON.stringify({ success: true, data: existingTenant }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create new tenant
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          external_app_id: payload.external_app_id,
          name: payload.name,
          owner_user_id: payload.owner_user_id,
          owner_email: payload.owner_email,
          domain: payload.domain,
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      // Get the default plan (Starter) or specified plan
      const planName = payload.plan_name || 'Starter';
      const { data: plan, error: planError } = await supabase
        .from('plans')
        .select('*')
        .eq('name', planName)
        .eq('is_active', true)
        .maybeSingle();

      if (planError || !plan) throw new Error('Plan not found');

      // Create trial subscription
      const now = new Date();
      const trialEnd = new Date(now.getTime() + plan.trial_days * 24 * 60 * 60 * 1000);

      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .insert({
          tenant_id: tenant.id,
          plan_id: plan.id,
          status: 'trialing',
          period_start: now.toISOString(),
          period_end: trialEnd.toISOString(),
          trial_start: now.toISOString(),
          trial_end: trialEnd.toISOString(),
        })
        .select('*, plan:plans(*)')
        .single();

      if (subError) throw subError;

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            tenant,
            subscription,
          },
        }),
        {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // GET /tenants/:external_app_id - Get tenant and subscription info
    if (path.startsWith('/tenants/') && req.method === 'GET') {
      const external_app_id = path.split('/')[2];

      const { data: tenant, error } = await supabase
        .from('tenants')
        .select(`
          *,
          subscriptions(
            *,
            plan:plans(*)
          )
        `)
        .eq('external_app_id', external_app_id)
        .maybeSingle();

      if (error) throw error;
      if (!tenant) {
        return new Response(
          JSON.stringify({ success: false, error: 'Tenant not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(JSON.stringify({ success: true, data: tenant }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /licenses/issue - Issue a new license
    if (path === '/licenses/issue' && req.method === 'POST') {
      const payload: LicenseValidationPayload = await req.json();

      // Get active subscription
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('*, plan:plans(*)')
        .eq('tenant_id', payload.tenant_id)
        .in('status', ['trialing', 'active'])
        .maybeSingle();

      if (subError) throw subError;
      if (!subscription) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No active subscription found',
          }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Generate unique JTI
      const jti = crypto.randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

      // Create license
      const { data: license, error: licenseError } = await supabase
        .from('licenses')
        .insert({
          tenant_id: payload.tenant_id,
          subscription_id: subscription.id,
          jti,
          type: subscription.status === 'trialing' ? 'trial' : 'paid',
          status: 'active',
          issued_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          entitlements: subscription.plan.entitlements,
        })
        .select()
        .single();

      if (licenseError) throw licenseError;

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            license,
            subscription,
            entitlements: subscription.plan.entitlements,
          },
        }),
        {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // POST /licenses/validate - Validate a license by JTI
    if (path === '/licenses/validate' && req.method === 'POST') {
      const { jti } = await req.json();

      const { data: license, error } = await supabase
        .from('licenses')
        .select('*')
        .eq('jti', jti)
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;

      if (!license) {
        return new Response(
          JSON.stringify({ success: false, valid: false, error: 'License not found or revoked' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const now = new Date();
      const expiresAt = new Date(license.expires_at);

      if (now > expiresAt) {
        await supabase
          .from('licenses')
          .update({ status: 'expired' })
          .eq('id', license.id);

        return new Response(
          JSON.stringify({ success: false, valid: false, error: 'License expired' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          valid: true,
          data: license,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT /subscriptions/upgrade - Upgrade subscription to paid
    if (path === '/subscriptions/upgrade' && req.method === 'PUT') {
      const payload: SubscriptionUpdatePayload = await req.json();

      // Get current subscription
      const { data: currentSub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', payload.tenant_id)
        .maybeSingle();

      if (!currentSub) {
        return new Response(
          JSON.stringify({ success: false, error: 'Subscription not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Get new plan
      const { data: newPlan } = await supabase
        .from('plans')
        .select('*')
        .eq('id', payload.plan_id)
        .maybeSingle();

      if (!newPlan) {
        return new Response(
          JSON.stringify({ success: false, error: 'Plan not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Update subscription
      const now = new Date();
      const periodEnd = new Date(
        now.getTime() +
          (newPlan.billing_cycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000
      );

      const { data: updatedSub, error: updateError } = await supabase
        .from('subscriptions')
        .update({
          plan_id: payload.plan_id,
          status: 'active',
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
          payment_provider: payload.payment_provider,
          provider_subscription_id: payload.provider_subscription_id,
          provider_customer_id: payload.provider_customer_id,
        })
        .eq('id', currentSub.id)
        .select('*, plan:plans(*)')
        .single();

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ success: true, data: updatedSub }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /usage/:tenant_id - Get usage stats
    if (path.startsWith('/usage/') && req.method === 'GET') {
      const tenant_id = path.split('/')[2];

      const { data: usage, error } = await supabase
        .from('usage')
        .select('*')
        .eq('tenant_id', tenant_id)
        .order('recorded_at', { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data: usage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Route not found' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});