import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Admin-Token',
};

interface AdminContext {
  adminUserId: string;
  role: string;
  permissions: any;
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
    const path = url.pathname.replace('/admin-api', '');

    // Simple admin authentication (in production, validate JWT from your auth system)
    const adminToken = req.headers.get('X-Admin-Token');
    if (!adminToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin user (simplified - in production, decode and verify JWT)
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('*')
      .eq('external_user_id', adminToken)
      .eq('is_active', true)
      .maybeSingle();

    if (!adminUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid admin credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminContext: AdminContext = {
      adminUserId: adminUser.id,
      role: adminUser.role,
      permissions: adminUser.permissions,
    };

    // Helper function to log audit
    const logAudit = async (action: string, entityType: string, entityId: string, changes: any) => {
      await supabase.from('admin_audit_log').insert({
        admin_user_id: adminContext.adminUserId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        changes,
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown',
      });
    };

    // GET /applications - List all applications
    if (path === '/applications' && req.method === 'GET') {
      const { data: applications, error } = await supabase
        .from('applications')
        .select('*')
        .order('name');

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data: applications }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /applications - Create new application
    if (path === '/applications' && req.method === 'POST') {
      const payload = await req.json();

      const { data: application, error } = await supabase
        .from('applications')
        .insert({
          name: payload.name,
          slug: payload.slug,
          external_app_id: payload.external_app_id,
          webhook_url: payload.webhook_url,
          settings: payload.settings || {},
        })
        .select()
        .single();

      if (error) throw error;

      await logAudit('create_application', 'application', application.id, payload);

      return new Response(
        JSON.stringify({ success: true, data: application }),
        {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // GET /tenants - List all tenants with their subscriptions
    if (path === '/tenants' && req.method === 'GET') {
      const { data: tenants, error } = await supabase
        .from('tenants')
        .select(`
          *,
          tenant_applications(
            *,
            application:applications(*),
            subscription:subscriptions(
              *,
              plan:plans(*)
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data: tenants }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /tenants - Create new tenant
    if (path === '/tenants' && req.method === 'POST') {
      const payload = await req.json();

      const { data: tenant, error } = await supabase
        .from('tenants')
        .insert({
          name: payload.name,
          organization_name: payload.organization_name || payload.name,
          owner_user_id: payload.owner_user_id,
          owner_email: payload.owner_email,
          billing_email: payload.billing_email || payload.owner_email,
          domain: payload.domain,
          tax_id: payload.tax_id,
          metadata: payload.metadata || {},
        })
        .select()
        .single();

      if (error) throw error;

      await logAudit('create_tenant', 'tenant', tenant.id, payload);

      return new Response(
        JSON.stringify({ success: true, data: tenant }),
        {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // GET /tenants/:id - Get tenant details
    if (path.match(/^\/tenants\/[0-9a-f-]+$/) && req.method === 'GET') {
      const tenantId = path.split('/')[2];

      const { data: tenant, error } = await supabase
        .from('tenants')
        .select(`
          *,
          tenant_applications(
            *,
            application:applications(*),
            subscription:subscriptions(
              *,
              plan:plans(*)
            )
          )
        `)
        .eq('id', tenantId)
        .maybeSingle();

      if (error) throw error;
      if (!tenant) {
        return new Response(
          JSON.stringify({ success: false, error: 'Tenant not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ success: true, data: tenant }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /tenants/:id/grant-access - Grant application access to tenant
    if (path.match(/^\/tenants\/[0-9a-f-]+\/grant-access$/) && req.method === 'POST') {
      const tenantId = path.split('/')[2];
      const payload = await req.json();

      // Check if access already exists
      const { data: existing } = await supabase
        .from('tenant_applications')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('application_id', payload.application_id)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ success: false, error: 'Access already granted' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create subscription if plan_id provided
      let subscriptionId = null;
      if (payload.plan_id) {
        const { data: plan } = await supabase
          .from('plans')
          .select('*')
          .eq('id', payload.plan_id)
          .maybeSingle();

        if (plan) {
          const now = new Date();
          const periodEnd = new Date(
            now.getTime() +
              (plan.billing_cycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000
          );

          const { data: subscription } = await supabase
            .from('subscriptions')
            .insert({
              tenant_id: tenantId,
              plan_id: payload.plan_id,
              application_id: payload.application_id,
              status: payload.start_trial ? 'trialing' : 'active',
              period_start: now.toISOString(),
              period_end: periodEnd.toISOString(),
              trial_start: payload.start_trial ? now.toISOString() : null,
              trial_end: payload.start_trial
                ? new Date(now.getTime() + plan.trial_days * 24 * 60 * 60 * 1000).toISOString()
                : null,
            })
            .select()
            .single();

          subscriptionId = subscription?.id;
        }
      }

      // Grant access
      const { data: access, error } = await supabase
        .from('tenant_applications')
        .insert({
          tenant_id: tenantId,
          application_id: payload.application_id,
          subscription_id: subscriptionId,
          status: 'active',
          granted_by: adminContext.adminUserId,
          notes: payload.notes,
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

      if (error) throw error;

      await logAudit('grant_access', 'tenant_application', access.id, payload);

      return new Response(
        JSON.stringify({ success: true, data: access }),
        {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // PUT /tenants/:id/revoke-access/:app_id - Revoke application access
    if (path.match(/^\/tenants\/[0-9a-f-]+\/revoke-access\/[0-9a-f-]+$/) && req.method === 'PUT') {
      const parts = path.split('/');
      const tenantId = parts[2];
      const applicationId = parts[4];

      const { data: access, error } = await supabase
        .from('tenant_applications')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('application_id', applicationId)
        .select()
        .single();

      if (error) throw error;

      await logAudit('revoke_access', 'tenant_application', access.id, {
        tenant_id: tenantId,
        application_id: applicationId,
      });

      return new Response(JSON.stringify({ success: true, data: access }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PUT /subscriptions/:id/change-plan - Change subscription plan
    if (path.match(/^\/subscriptions\/[0-9a-f-]+\/change-plan$/) && req.method === 'PUT') {
      const subscriptionId = path.split('/')[2];
      const payload = await req.json();

      const { data: plan } = await supabase
        .from('plans')
        .select('*')
        .eq('id', payload.plan_id)
        .maybeSingle();

      if (!plan) {
        return new Response(
          JSON.stringify({ success: false, error: 'Plan not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const now = new Date();
      const periodEnd = new Date(
        now.getTime() +
          (plan.billing_cycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000
      );

      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .update({
          plan_id: payload.plan_id,
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', subscriptionId)
        .select('*, plan:plans(*)')
        .single();

      if (error) throw error;

      await logAudit('change_plan', 'subscription', subscriptionId, payload);

      return new Response(JSON.stringify({ success: true, data: subscription }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PUT /subscriptions/:id/status - Change subscription status
    if (path.match(/^\/subscriptions\/[0-9a-f-]+\/status$/) && req.method === 'PUT') {
      const subscriptionId = path.split('/')[2];
      const payload = await req.json();

      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .update({
          status: payload.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscriptionId)
        .select('*, plan:plans(*)')
        .single();

      if (error) throw error;

      await logAudit('change_status', 'subscription', subscriptionId, payload);

      return new Response(JSON.stringify({ success: true, data: subscription }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /audit-log - Get audit log
    if (path === '/audit-log' && req.method === 'GET') {
      const limit = url.searchParams.get('limit') || '50';
      const offset = url.searchParams.get('offset') || '0';

      const { data: logs, error } = await supabase
        .from('admin_audit_log')
        .select('*, admin_user:admin_users(name, email)')
        .order('created_at', { ascending: false })
        .limit(parseInt(limit))
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data: logs }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /stats - Get dashboard statistics
    if (path === '/stats' && req.method === 'GET') {
      const { count: tenantsCount } = await supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true });

      const { count: activeSubscriptions } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .in('status', ['active', 'trialing']);

      const { count: applicationsCount } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const { data: recentTenants } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            tenants_count: tenantsCount || 0,
            active_subscriptions: activeSubscriptions || 0,
            applications_count: applicationsCount || 0,
            recent_tenants: recentTenants || [],
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
    console.error('Admin API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        details: errorStack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});