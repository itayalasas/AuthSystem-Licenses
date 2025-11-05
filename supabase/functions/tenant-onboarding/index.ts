import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface OnboardingPayload {
  external_app_id: string;
  user_id: string;
  email: string;
  name: string;
  company_name?: string;
  subdomain?: string;
  plan_id?: string;
  start_trial?: boolean;
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

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Método no permitido' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: OnboardingPayload = await req.json();

    const { external_app_id, user_id, email, name, company_name, subdomain, plan_id, start_trial = true } = payload;

    if (!external_app_id || !user_id || !email || !name) {
      return new Response(
        JSON.stringify({ success: false, error: 'Faltan campos requeridos: external_app_id, user_id, email, name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: application } = await supabase
      .from('applications')
      .select('*')
      .eq('external_app_id', external_app_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!application) {
      return new Response(
        JSON.stringify({ success: false, error: 'Aplicación no encontrada o inactiva' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const application_id = application.id;

    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('*, tenant_applications!inner(*)')
      .eq('owner_user_id', user_id)
      .eq('tenant_applications.application_id', application_id)
      .maybeSingle();

    if (existingTenant) {
      const { data: tenantApp } = await supabase
        .from('tenant_applications')
        .select(`
          *,
          subscription:subscriptions(
            *,
            plan:plans(*)
          )
        `)
        .eq('tenant_id', existingTenant.id)
        .eq('application_id', application_id)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          success: true,
          message: 'El usuario ya tiene un tenant existente',
          tenant: existingTenant,
          tenant_application: tenantApp,
          is_new: false,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let tenantSubdomain = subdomain;
    if (!tenantSubdomain) {
      tenantSubdomain = `${company_name || name}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const timestamp = Date.now().toString(36).slice(-4);
      tenantSubdomain = `${tenantSubdomain}-${timestamp}`;
    }

    const tenantName = company_name || name;
    const organizationName = company_name || `${name} Org`;

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: tenantName,
        organization_name: organizationName,
        owner_user_id: user_id,
        owner_email: email,
        billing_email: email,
        domain: `${tenantSubdomain}.netlify.app`,
        status: 'active',
        metadata: {
          subdomain: tenantSubdomain,
          created_via: 'auto-onboarding',
          external_app_id: external_app_id,
          onboarded_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (tenantError) throw tenantError;

    let selectedPlanId = plan_id;
    if (!selectedPlanId) {
      const { data: trialPlan } = await supabase
        .from('plans')
        .select('*')
        .eq('name', 'Starter')
        .eq('is_active', true)
        .maybeSingle();

      if (trialPlan) {
        selectedPlanId = trialPlan.id;
      }
    }

    let subscription = null;
    if (selectedPlanId) {
      const { data: plan } = await supabase
        .from('plans')
        .select('*')
        .eq('id', selectedPlanId)
        .maybeSingle();

      if (plan) {
        const now = new Date();
        const trialDays = start_trial ? plan.trial_days : 0;
        const billingCycleDays = plan.billing_cycle === 'annual' ? 365 : 30;

        const periodEnd = new Date(now.getTime() + billingCycleDays * 24 * 60 * 60 * 1000);
        const trialEnd = start_trial
          ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000)
          : null;

        const { data: newSubscription, error: subError } = await supabase
          .from('subscriptions')
          .insert({
            tenant_id: tenant.id,
            plan_id: selectedPlanId,
            application_id: application_id,
            status: start_trial ? 'trialing' : 'active',
            period_start: now.toISOString(),
            period_end: periodEnd.toISOString(),
            trial_start: start_trial ? now.toISOString() : null,
            trial_end: trialEnd ? trialEnd.toISOString() : null,
          })
          .select('*, plan:plans(*)')
          .single();

        if (subError) throw subError;
        subscription = newSubscription;
      }
    }

    const { data: tenantApp, error: appError } = await supabase
      .from('tenant_applications')
      .insert({
        tenant_id: tenant.id,
        application_id: application_id,
        subscription_id: subscription?.id,
        status: 'active',
        granted_by: 'system',
        notes: 'Auto-creado durante onboarding',
      })
      .select(`
        *,
        application:applications(*),
        subscription:subscriptions(
          *,
          plan:plans(*)
        )
      `)
      .single();

    if (appError) throw appError;

    if (subscription) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const jti = crypto.randomUUID();

      await supabase.from('licenses').insert({
        tenant_id: tenant.id,
        subscription_id: subscription.id,
        jti,
        type: start_trial ? 'trial' : 'paid',
        status: 'active',
        issued_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        entitlements: subscription.plan.entitlements,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Tenant creado exitosamente',
        tenant,
        subscription,
        tenant_application: tenantApp,
        is_new: true,
        netlify_info: {
          subdomain: tenantSubdomain,
          url: `https://${tenantSubdomain}.netlify.app`,
          instructions: {
            step1: 'Ve a tu proyecto en Netlify',
            step2: 'Ve a Domain settings > Add domain alias',
            step3: `Agrega: ${tenantSubdomain}.tu-dominio.com`,
            step4: 'Netlify generará automáticamente el certificado SSL',
            alternative: `O usa el subdominio de Netlify: ${tenantSubdomain}.netlify.app`,
          },
        },
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error en onboarding:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
