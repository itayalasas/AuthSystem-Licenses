import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
};

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
    const path = url.pathname.replace('/validation-api', '');

    // Validate API key from application
    const apiKey = req.headers.get('X-API-Key');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'API key required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify application
    const { data: application } = await supabase
      .from('applications')
      .select('*')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .maybeSingle();

    if (!application) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /validate-user - Check if user has access to this application
    if (path === '/validate-user' && req.method === 'POST') {
      const payload = await req.json();
      const { external_user_id, user_email } = payload;

      if (!external_user_id && !user_email) {
        return new Response(
          JSON.stringify({ success: false, error: 'User identifier required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find tenant by user
      let query = supabase
        .from('tenants')
        .select(`
          *,
          tenant_applications!inner(
            *,
            subscription:subscriptions(
              *,
              plan:plans(*)
            )
          )
        `)
        .eq('tenant_applications.application_id', application.id)
        .eq('tenant_applications.status', 'active');

      if (external_user_id) {
        query = query.eq('owner_user_id', external_user_id);
      } else if (user_email) {
        query = query.eq('owner_email', user_email);
      }

      const { data: tenants } = await query;

      if (!tenants || tenants.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            has_access: false,
            message: 'User does not have access to this application',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tenant = tenants[0];
      const tenantApp = tenant.tenant_applications[0];
      const subscription = tenantApp.subscription;

      // Check if subscription is valid
      let isValid = false;
      let reason = '';

      if (!subscription) {
        reason = 'No subscription found';
      } else if (subscription.status === 'active' || subscription.status === 'trialing') {
        const now = new Date();
        const periodEnd = new Date(subscription.period_end);

        if (now <= periodEnd) {
          isValid = true;
        } else {
          reason = 'Subscription expired';
        }
      } else {
        reason = `Subscription status: ${subscription.status}`;
      }

      // Generate short-lived license token
      let licenseToken = null;
      if (isValid && subscription) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
        const jti = crypto.randomUUID();

        const { data: license } = await supabase
          .from('licenses')
          .insert({
            tenant_id: tenant.id,
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

        if (license) {
          licenseToken = {
            jti: license.jti,
            tenant_id: license.tenant_id,
            expires_at: license.expires_at,
            entitlements: license.entitlements,
          };
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          has_access: isValid,
          tenant,
          subscription,
          license: licenseToken,
          reason: isValid ? undefined : reason,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /validate-license - Validate a license token
    if (path === '/validate-license' && req.method === 'POST') {
      const payload = await req.json();
      const { jti } = payload;

      if (!jti) {
        return new Response(
          JSON.stringify({ success: false, error: 'License JTI required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: license } = await supabase
        .from('licenses')
        .select('*, subscription:subscriptions(*, plan:plans(*))')
        .eq('jti', jti)
        .eq('status', 'active')
        .maybeSingle();

      if (!license) {
        return new Response(
          JSON.stringify({
            success: true,
            valid: false,
            reason: 'License not found or revoked',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const now = new Date();
      const expiresAt = new Date(license.expires_at);

      if (now > expiresAt) {
        // Mark as expired
        await supabase
          .from('licenses')
          .update({ status: 'expired' })
          .eq('id', license.id);

        return new Response(
          JSON.stringify({
            success: true,
            valid: false,
            reason: 'License expired',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          valid: true,
          license: {
            jti: license.jti,
            tenant_id: license.tenant_id,
            type: license.type,
            expires_at: license.expires_at,
            entitlements: license.entitlements,
          },
          subscription: license.subscription,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /check-feature - Check if a feature is enabled
    if (path === '/check-feature' && req.method === 'GET') {
      const jti = url.searchParams.get('jti');
      const feature = url.searchParams.get('feature');

      if (!jti || !feature) {
        return new Response(
          JSON.stringify({ success: false, error: 'JTI and feature required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: license } = await supabase
        .from('licenses')
        .select('*')
        .eq('jti', jti)
        .eq('status', 'active')
        .maybeSingle();

      if (!license) {
        return new Response(
          JSON.stringify({
            success: true,
            enabled: false,
            reason: 'Invalid license',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const enabled = license.entitlements?.features?.[feature] === true;

      return new Response(
        JSON.stringify({
          success: true,
          enabled,
          entitlements: license.entitlements,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /record-usage - Record usage metric
    if (path === '/record-usage' && req.method === 'POST') {
      const payload = await req.json();
      const { tenant_id, metric, value, metadata } = payload;

      if (!tenant_id || !metric || value === undefined) {
        return new Response(
          JSON.stringify({ success: false, error: 'Tenant ID, metric, and value required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const { data: usage, error } = await supabase
        .from('usage')
        .insert({
          tenant_id,
          metric,
          value,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          metadata: metadata || {},
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: usage }),
        {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
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