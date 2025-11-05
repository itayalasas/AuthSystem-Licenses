import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization, X-Client-Info, Apikey',
};

// Helper function to enrich entitlements with catalog information
async function enrichEntitlements(supabase: any, entitlements: any) {
  if (!entitlements?.features) {
    return { features: [] };
  }

  const featureCodes = Object.keys(entitlements.features);

  if (featureCodes.length === 0) {
    return { features: [] };
  }

  // Get feature catalog info for all features
  const { data: catalogFeatures } = await supabase
    .from('feature_catalog')
    .select('code, name, description, value_type, unit, category')
    .in('code', featureCodes)
    .eq('active', true);

  const catalogMap = new Map(
    catalogFeatures?.map((f: any) => [f.code, f]) || []
  );

  // Transform features to enriched format
  const enrichedFeatures = featureCodes.map(code => {
    const catalog = catalogMap.get(code);
    const value = entitlements.features[code];

    return {
      code,
      name: catalog?.name || code,
      description: catalog?.description || '',
      value,
      value_type: catalog?.value_type || 'text',
      unit: catalog?.unit,
      category: catalog?.category || 'other',
    };
  });

  return { features: enrichedFeatures };
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
    const path = url.pathname.replace('/validation-api', '');

    // POST /validate-user - Check if user has access to this application
    if (path === '/validate-user' && req.method === 'POST') {
      const payload = await req.json();
      const { external_user_id, user_email, external_app_id } = payload;

      if (!external_user_id && !user_email) {
        return new Response(
          JSON.stringify({ success: false, error: 'User identifier required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!external_app_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'external_app_id required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify application
      const { data: application } = await supabase
        .from('applications')
        .select('*')
        .eq('external_app_id', external_app_id)
        .eq('is_active', true)
        .maybeSingle();

      if (!application) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid external_app_id or application not active' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

      // Get existing license
      let licenseData = null;
      let enrichedEntitlements = null;

      if (isValid && subscription && subscription.plan) {
        enrichedEntitlements = await enrichEntitlements(supabase, subscription.plan.entitlements);

        // Query for existing license
        const { data: license } = await supabase
          .from('licenses')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('application_id', application.id)
          .eq('status', 'active')
          .maybeSingle();

        if (license) {
          licenseData = {
            license_key: license.license_key,
            tenant_id: license.tenant_id,
            application_id: license.application_id,
            plan_id: license.plan_id,
            status: license.status,
            expires_at: license.expires_at,
          };
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          has_access: isValid,
          tenant: {
            id: tenant.id,
            name: tenant.name,
            owner_user_id: tenant.owner_user_id,
            owner_email: tenant.owner_email,
            organization_name: tenant.organization_name,
            status: tenant.status,
          },
          subscription: subscription ? {
            id: subscription.id,
            status: subscription.status,
            plan_name: subscription.plan?.name,
            plan_price: subscription.plan?.price,
            plan_currency: subscription.plan?.currency,
            trial_start: subscription.trial_start,
            trial_end: subscription.trial_end,
            period_start: subscription.period_start,
            period_end: subscription.period_end,
            entitlements: enrichedEntitlements,
          } : null,
          license: licenseData,
          reason: isValid ? undefined : reason,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /validate-license - Validate a license token
    if (path === '/validate-license' && req.method === 'POST') {
      const payload = await req.json();
      const { jti, external_app_id } = payload;

      if (!jti) {
        return new Response(
          JSON.stringify({ success: false, error: 'License JTI required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!external_app_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'external_app_id required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify application
      const { data: application } = await supabase
        .from('applications')
        .select('*')
        .eq('external_app_id', external_app_id)
        .eq('is_active', true)
        .maybeSingle();

      if (!application) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid external_app_id or application not active' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

      const enrichedEntitlements = await enrichEntitlements(supabase, license.entitlements);

      return new Response(
        JSON.stringify({
          success: true,
          valid: true,
          license: {
            jti: license.jti,
            tenant_id: license.tenant_id,
            type: license.type,
            expires_at: license.expires_at,
            entitlements: enrichedEntitlements,
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
      const external_app_id = url.searchParams.get('external_app_id');

      if (!jti || !feature || !external_app_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'JTI, feature, and external_app_id required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify application
      const { data: application } = await supabase
        .from('applications')
        .select('*')
        .eq('external_app_id', external_app_id)
        .eq('is_active', true)
        .maybeSingle();

      if (!application) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid external_app_id or application not active' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

      const enrichedEntitlements = await enrichEntitlements(supabase, license.entitlements);
      const featureData = enrichedEntitlements.features.find((f: any) => f.code === feature);
      const enabled = featureData?.value === true || featureData?.value === 'true';

      return new Response(
        JSON.stringify({
          success: true,
          enabled,
          feature: featureData || null,
          entitlements: enrichedEntitlements,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /record-usage - Record usage metric
    if (path === '/record-usage' && req.method === 'POST') {
      const payload = await req.json();
      const { tenant_id, metric, value, metadata, external_app_id } = payload;

      if (!tenant_id || !metric || value === undefined) {
        return new Response(
          JSON.stringify({ success: false, error: 'Tenant ID, metric, and value required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!external_app_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'external_app_id required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify application
      const { data: application } = await supabase
        .from('applications')
        .select('*')
        .eq('external_app_id', external_app_id)
        .eq('is_active', true)
        .maybeSingle();

      if (!application) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid external_app_id or application not active' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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