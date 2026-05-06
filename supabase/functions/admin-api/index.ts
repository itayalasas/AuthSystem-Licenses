import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Admin-Token",
};

const ADMIN_TOKEN = "admin_001";
const ENV_API_URL = 'https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/get-env';
const ACCESS_KEY = '033b6f38b0c5b902c90dbb1f371c389f967a0afa871028da2ab5657062cab866';

async function getConfigFromAPI(): Promise<Record<string, string>> {
  try {
    const response = await fetch(ENV_API_URL, {
      headers: {
        'X-Access-Key': ACCESS_KEY,
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch config from API:', response.status);
      return {};
    }

    const data = await response.json();
    return data.variables || {};
  } catch (err) {
    console.error("Error fetching config from API:", err);
    return {};
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const adminToken = req.headers.get("X-Admin-Token");
    if (adminToken !== ADMIN_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const url = new URL(req.url);
    const path = url.pathname.replace("/admin-api", "").replace(/^\//, "");
    const method = req.method;

    if (path === "stats" && method === "GET") {
      const { data: tenants } = await supabase.from("tenants").select("id");
      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("status", "active");
      const { data: applications } = await supabase.from("applications").select("id");
      const { data: recent_tenants } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            total_tenants: tenants?.length || 0,
            active_subscriptions: subscriptions?.length || 0,
            total_applications: applications?.length || 0,
            recent_tenants: recent_tenants || [],
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path === "tenants" && method === "GET") {
      const { data, error } = await supabase
        .from("tenants")
        .select(`
          *,
          subscriptions(
            id,
            status,
            period_start,
            period_end,
            trial_end,
            plan:plans(
              name,
              price,
              currency,
              billing_cycle
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path === "tenants" && method === "POST") {
      const body = await req.json();

      if (!body.owner_email) {
        return new Response(
          JSON.stringify({ success: false, error: "owner_email is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .insert({
          name: body.name,
          organization_name: body.organization_name || body.name,
          owner_user_id: body.owner_user_id,
          owner_email: body.owner_email,
          billing_email: body.billing_email || body.owner_email,
          external_tenant_id: body.external_tenant_id || null,
          domain: body.domain || null,
          tax_id: body.tax_id || null,
          metadata: body.metadata || {},
          status: "active",
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      if (body.plan_id) {
        const { data: plan } = await supabase
          .from("plans")
          .select("trial_days, billing_cycle")
          .eq("id", body.plan_id)
          .single();

        const trial_days = plan?.trial_days || 0;
        const now = new Date();
        const trial_end = new Date(now.getTime() + trial_days * 24 * 60 * 60 * 1000);
        const period_end =
          plan?.billing_cycle === "yearly"
            ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
            : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

        await supabase.from("subscriptions").insert({
          tenant_id: tenant.id,
          plan_id: body.plan_id,
          application_id: body.application_id,
          status: trial_days > 0 ? "trialing" : "active",
          period_start: now.toISOString(),
          period_end: period_end.toISOString(),
          current_period_start: now.toISOString(),
          current_period_end: period_end.toISOString(),
          trial_start: trial_days > 0 ? now.toISOString() : null,
          trial_end: trial_days > 0 ? trial_end.toISOString() : null,
        });
      }

      return new Response(
        JSON.stringify({ success: true, data: tenant }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.match(/^tenants\/[0-9a-f-]+$/) && method === "GET") {
      const tenantId = path.split("/")[1];

      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select(`
          *,
          subscriptions(
            id,
            status,
            period_start,
            period_end,
            trial_start,
            trial_end,
            plan:plans(
              id,
              name,
              price,
              currency,
              billing_cycle,
              entitlements
            )
          )
        `)
        .eq("id", tenantId)
        .single();

      if (tenantError) throw tenantError;

      const { data: tenantApps, error: appsError } = await supabase
        .from("tenant_applications")
        .select(`
          *,
          application:applications(
            id,
            name,
            slug
          )
        `)
        .eq("tenant_id", tenantId);

      if (appsError) throw appsError;

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            ...tenant,
            applications: tenantApps,
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.match(/^tenants\/[0-9a-f-]+$/) && method === "DELETE") {
      const tenantId = path.split("/")[1];

      await supabase.from("subscriptions").delete().eq("tenant_id", tenantId);
      await supabase.from("tenant_applications").delete().eq("tenant_id", tenantId);
      const { error } = await supabase.from("tenants").delete().eq("id", tenantId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path === "applications" && method === "GET") {
      const { data, error } = await supabase
        .from("applications")
        .select(`
          *,
          plan:plans!plan_id(
            id,
            name,
            price,
            currency,
            billing_cycle
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const enrichedData = await Promise.all(
        (data || []).map(async (app) => {
          const { count: usersCount } = await supabase
            .from("application_users")
            .select("*", { count: "exact", head: true })
            .eq("application_id", app.id);

          const { count: plansCount } = await supabase
            .from("plans")
            .select("*", { count: "exact", head: true })
            .eq("application_id", app.id);

          return {
            ...app,
            users_count: usersCount || 0,
            plans_count: plansCount || 0,
          };
        })
      );

      return new Response(
        JSON.stringify({ success: true, data: enrichedData }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path === "applications" && method === "POST") {
      const body = await req.json();

      const { data, error } = await supabase
        .from("applications")
        .insert(body)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.match(/^applications\/[0-9a-f-]+$/) && method === "PUT") {
      const applicationId = path.split("/")[1];
      const body = await req.json();

      const { data, error } = await supabase
        .from("applications")
        .update(body)
        .eq("id", applicationId)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.match(/^applications\/[0-9a-f-]+$/) && method === "DELETE") {
      const applicationId = path.split("/")[1];

      const { error } = await supabase
        .from("applications")
        .delete()
        .eq("id", applicationId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path === "plans" && method === "GET") {
      const applicationId = url.searchParams.get("application_id");

      let query = supabase.from("plans").select("*");

      if (applicationId) {
        query = query.eq("application_id", applicationId);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path === "plans" && method === "POST") {
      const body = await req.json();

      if (!body.application_id) {
        return new Response(
          JSON.stringify({ success: false, error: "application_id is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const insertData: any = {
        application_id: body.application_id,
        name: body.name,
        description: body.description || null,
        price: body.price,
        currency: body.currency || 'USD',
        billing_cycle: body.billing_cycle,
        trial_days: body.trial_days ?? 0,
        entitlements: body.entitlements || {},
        is_active: body.is_active !== undefined ? body.is_active : true,
        sort_order: body.sort_order ?? 0,
        billing_day: body.billing_day !== '' && body.billing_day != null ? parseInt(body.billing_day) : null,
        external_reference: body.external_reference !== '' ? body.external_reference || null : null,
      };

      const { data: plan, error } = await supabase
        .from("plans")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: plan }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.match(/^plans\/[0-9a-f-]+$/) && method === "PUT") {
      const planId = path.split("/")[1];
      const body = await req.json();

      const updateData: any = {
        name: body.name,
        description: body.description,
        price: body.price,
        currency: body.currency,
        billing_cycle: body.billing_cycle,
        entitlements: body.entitlements,
        updated_at: new Date().toISOString(),
      };

      if (body.trial_days !== undefined) {
        updateData.trial_days = body.trial_days;
      }

      if (body.is_active !== undefined) {
        updateData.is_active = body.is_active;
      }

      if (body.sort_order !== undefined) {
        updateData.sort_order = body.sort_order;
      }

      if (body.application_id && body.application_id !== '') {
        updateData.application_id = body.application_id;
      }

      if (body.billing_day !== undefined) {
        updateData.billing_day = body.billing_day !== '' && body.billing_day != null ? parseInt(body.billing_day) : null;
      }

      if (body.external_reference !== undefined) {
        updateData.external_reference = body.external_reference !== '' ? body.external_reference : null;
      }

      const { data: plan, error } = await supabase
        .from("plans")
        .update(updateData)
        .eq("id", planId)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: plan }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.match(/^plans\/[0-9a-f-]+$/) && method === "DELETE") {
      const planId = path.split("/")[1];

      const { data: plan, error: planFetchError } = await supabase
        .from("plans")
        .select("id, name, mp_preapproval_plan_id, mp_status")
        .eq("id", planId)
        .single();

      if (planFetchError || !plan) {
        return new Response(
          JSON.stringify({ success: false, error: "Plan not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If plan is synced with MercadoPago, mark it as cancelled there via PUT
      if (plan.mp_preapproval_plan_id) {
        try {
          const config = await getConfigFromAPI();
          const mercadopagoAccessToken = config.MERCADOPAGO_ACCESS_TOKEN;
          if (mercadopagoAccessToken && mercadopagoAccessToken !== "your_mercadopago_access_token_here") {
            await fetch(`https://api.mercadopago.com/preapproval_plan/${plan.mp_preapproval_plan_id}`, {
              method: "PUT",
              headers: {
                "Authorization": `Bearer ${mercadopagoAccessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ status: "inactive" }),
            });
          }
        } catch (_) {
          // Non-fatal: continue with local deactivation even if MP call fails
        }
      }

      // Deactivate instead of hard delete to preserve data integrity
      const { error } = await supabase
        .from("plans")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", planId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (path.match(/^plans\/[0-9a-f-]+\/reactivate$/) && method === "POST") {
      const planId = path.split("/")[1];

      const { data: plan, error: planFetchError } = await supabase
        .from("plans")
        .select("id, name, mp_preapproval_plan_id")
        .eq("id", planId)
        .single();

      if (planFetchError || !plan) {
        return new Response(
          JSON.stringify({ success: false, error: "Plan not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If synced with MP, try to reactivate there too
      if (plan.mp_preapproval_plan_id) {
        try {
          const config = await getConfigFromAPI();
          const mercadopagoAccessToken = config.MERCADOPAGO_ACCESS_TOKEN;
          if (mercadopagoAccessToken && mercadopagoAccessToken !== "your_mercadopago_access_token_here") {
            await fetch(`https://api.mercadopago.com/preapproval_plan/${plan.mp_preapproval_plan_id}`, {
              method: "PUT",
              headers: {
                "Authorization": `Bearer ${mercadopagoAccessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ status: "active" }),
            });
          }
        } catch (_) {
          // Non-fatal
        }
      }

      const { error } = await supabase
        .from("plans")
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq("id", planId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (path === "audit-log" && method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const offset = parseInt(url.searchParams.get("offset") || "0");

      const { data, error } = await supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.match(/^applications\/[0-9a-f-]+\/users$/) && req.method === "GET") {
      const applicationId = path.split("/")[1];

      // Get application to know auth_type
      const { data: application } = await supabase
        .from("applications")
        .select("id, name, auth_type")
        .eq("id", applicationId)
        .maybeSingle();

      const authType = application?.auth_type || "basic";

      const { data: users, error } = await supabase
        .from("application_users")
        .select("*")
        .eq("application_id", applicationId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // For tenant-type apps, group users by tenant
      if (authType === "tenant" || authType === "hybrid") {
        // Get all tenants that have members in this application
        const { data: tenantMembers } = await supabase
          .from("tenant_members")
          .select("tenant_id, external_user_id, email, name, status, last_login, created_at")
          .eq("application_id", applicationId);

        // Get all tenants for this application via tenant_applications
        const { data: tenantApps } = await supabase
          .from("tenant_applications")
          .select(`
            tenant_id,
            subscription:subscriptions(
              id,
              status,
              trial_end,
              period_end,
              period_start,
              plan:plans(
                id,
                name,
                price,
                currency,
                billing_cycle
              )
            ),
            tenant:tenants(
              id,
              name,
              status,
              owner_user_id,
              created_at
            )
          `)
          .eq("application_id", applicationId);

        // Build tenant list with members and licenses
        const tenantsById = new Map<string, any>();

        for (const ta of (tenantApps || [])) {
          const tenant = ta.tenant as any;
          if (!tenant) continue;

          const { data: license } = await supabase
            .from("licenses")
            .select("*")
            .eq("tenant_id", tenant.id)
            .eq("application_id", applicationId)
            .maybeSingle();

          const members = (tenantMembers || [])
            .filter((m: any) => m.tenant_id === tenant.id)
            .map((m: any) => ({
              external_user_id: m.external_user_id,
              email: m.email,
              name: m.name,
              status: m.status,
              last_login: m.last_login,
              created_at: m.created_at,
            }));

          tenantsById.set(tenant.id, {
            id: tenant.id,
            name: tenant.name,
            status: tenant.status,
            owner_user_id: tenant.owner_user_id,
            created_at: tenant.created_at,
            subscription: ta.subscription || null,
            license: license || null,
            members,
          });
        }

        // Also include tenants found via application_users that may not have tenant_applications yet
        for (const user of (users || [])) {
          const { data: tenant } = await supabase
            .from("tenants")
            .select("id, name, status, owner_user_id, created_at")
            .eq("owner_user_id", user.external_user_id)
            .maybeSingle();

          if (tenant && !tenantsById.has(tenant.id)) {
            tenantsById.set(tenant.id, {
              id: tenant.id,
              name: tenant.name,
              status: tenant.status,
              owner_user_id: tenant.owner_user_id,
              created_at: tenant.created_at,
              subscription: null,
              license: null,
              members: [{
                external_user_id: user.external_user_id,
                email: user.email,
                name: user.name,
                status: user.status,
                last_login: user.last_login,
                created_at: user.created_at,
              }],
            });
          }
        }

        const tenants = Array.from(tenantsById.values());

        return new Response(
          JSON.stringify({ success: true, data: tenants, mode: "tenant", total_users: (users || []).length }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Basic mode: flat list of users with their own subscription/license
      const enrichedUsers = await Promise.all(
        (users || []).map(async (user) => {
          const { data: tenant } = await supabase
            .from("tenants")
            .select("id, name, status")
            .eq("owner_user_id", user.external_user_id)
            .maybeSingle();

          if (!tenant) return { ...user, tenant: null, subscription: null, license: null };

          const { data: tenantApp } = await supabase
            .from("tenant_applications")
            .select(`
              subscription_id,
              subscription:subscriptions(
                id,
                status,
                trial_end,
                period_end,
                period_start,
                plan:plans(
                  id,
                  name,
                  price,
                  currency,
                  billing_cycle
                )
              )
            `)
            .eq("tenant_id", tenant.id)
            .eq("application_id", applicationId)
            .maybeSingle();

          const { data: license } = await supabase
            .from("licenses")
            .select("*")
            .eq("tenant_id", tenant.id)
            .eq("application_id", applicationId)
            .maybeSingle();

          return {
            ...user,
            tenant,
            subscription: tenantApp?.subscription || null,
            license: license || null,
          };
        })
      );

      return new Response(
        JSON.stringify({ success: true, data: enrichedUsers, mode: "basic", total_users: enrichedUsers.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (path === "features" && method === "GET") {
      const search = url.searchParams.get("search");
      const category = url.searchParams.get("category");

      let query = supabase
        .from("feature_catalog")
        .select("*")
        .eq("active", true);

      if (search) {
        query = query.or(
          `name.ilike.%${search}%,code.ilike.%${search}%,description.ilike.%${search}%`
        );
      }

      if (category) {
        query = query.eq("category", category);
      }

      const { data, error } = await query.order("category", { ascending: true });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path === "users/assign-plan" && method === "POST") {
      try {
        const body = await req.json();
        const { external_user_id, plan_id, application_id, force_active } = body;

        console.log('Assign plan request:', { external_user_id, plan_id, application_id, force_active });

        if (!external_user_id || !plan_id || !application_id) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Missing required fields: external_user_id, plan_id, application_id"
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // First, verify the application user exists and get tenant_id if available
        const { data: appUsers, error: appUserError } = await supabase
          .from("application_users")
          .select("id, tenant_id")
          .eq("external_user_id", external_user_id)
          .eq("application_id", application_id)
          .order("created_at", { ascending: false })
          .limit(1);

        const appUser = appUsers && appUsers.length > 0 ? appUsers[0] : null;

        if (appUserError) {
          console.error('Error finding application user:', appUserError);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Database error: ${appUserError.message}`
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        if (!appUser) {
          console.log('User not found:', { external_user_id, application_id });
          return new Response(
            JSON.stringify({
              success: false,
              error: "User not found in this application"
            }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        console.log('Found app user:', appUser);

        let tenant_id = appUser.tenant_id;

        // If tenant_id is not set in application_users, try to find it by owner_user_id or owner_email
        if (!tenant_id) {
          console.log('tenant_id not set in application_users, searching by owner...');

          // First: look for a tenant owned by this user
          const { data: tenantByOwner } = await supabase
            .from("tenants")
            .select("id")
            .eq("owner_user_id", external_user_id)
            .maybeSingle();

          if (tenantByOwner) {
            tenant_id = tenantByOwner.id;
            console.log('Found tenant_id from owner_user_id:', tenant_id);
          } else {
            // Second: look via tenant_members
            const { data: memberTenant } = await supabase
              .from("tenant_members")
              .select("tenant_id")
              .eq("user_id", external_user_id)
              .maybeSingle();

            if (memberTenant) {
              tenant_id = memberTenant.tenant_id;
              console.log('Found tenant_id from tenant_members:', tenant_id);
            } else {
              // Third: look by email in application_users
              const { data: userInfo } = await supabase
                .from("application_users")
                .select("email")
                .eq("id", appUser.id)
                .maybeSingle();

              if (userInfo?.email) {
                const { data: tenantByEmail } = await supabase
                  .from("tenants")
                  .select("id")
                  .eq("owner_email", userInfo.email)
                  .maybeSingle();

                if (tenantByEmail) {
                  tenant_id = tenantByEmail.id;
                  console.log('Found tenant_id from owner_email:', tenant_id);
                }
              }
            }
          }

          if (tenant_id) {
            await supabase
              .from("application_users")
              .update({ tenant_id })
              .eq("id", appUser.id);
          }
        }

        if (!tenant_id) {
          console.log('No tenant found for user:', { external_user_id, application_id });
          return new Response(
            JSON.stringify({
              success: false,
              error: "No tenant found for this user"
            }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        console.log('Using tenant_id:', tenant_id);
        const tenant = { id: tenant_id };

        const { data: plan, error: planError } = await supabase
          .from("plans")
          .select("*")
          .eq("id", plan_id)
          .eq("application_id", application_id)
          .maybeSingle();

        if (planError) {
          console.error('Error finding plan:', planError);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Database error: ${planError.message}`
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        if (!plan) {
          console.log('Plan not found:', { plan_id, application_id });
          return new Response(
            JSON.stringify({
              success: false,
              error: "Plan not found or doesn't belong to the specified application"
            }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        console.log('Found plan:', plan);

        const { data: existingSubscriptions, error: existingSubError } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("tenant_id", tenant.id)
          .eq("application_id", application_id)
          .order("created_at", { ascending: false })
          .limit(1);

        const existingSubscription = existingSubscriptions && existingSubscriptions.length > 0 ? existingSubscriptions[0] : null;

        if (existingSubError) {
          console.error('Error finding subscription:', existingSubError);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Database error: ${existingSubError.message}`
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        console.log('Existing subscription:', existingSubscription);

        let subscription;

        const useTrial = plan.trial_days > 0 && !force_active;
        const periodEnd = plan.billing_cycle === "annual"
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        if (existingSubscription) {
          console.log('Updating existing subscription');
          const { data: updatedSub, error: updateError } = await supabase
            .from("subscriptions")
            .update({
              plan_id: plan_id,
              status: useTrial ? "trialing" : "active",
              trial_start: useTrial ? new Date().toISOString() : null,
              trial_end: useTrial
                ? new Date(Date.now() + plan.trial_days * 24 * 60 * 60 * 1000).toISOString()
                : null,
              current_period_start: new Date().toISOString(),
              current_period_end: periodEnd,
              period_start: new Date().toISOString(),
              period_end: periodEnd,
            })
            .eq("id", existingSubscription.id)
            .select()
            .single();

          if (updateError) {
            console.error('Error updating subscription:', updateError);
            return new Response(
              JSON.stringify({
                success: false,
                error: `Failed to update subscription: ${updateError.message}`
              }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
          subscription = updatedSub;
          console.log('Subscription updated:', subscription);
        } else {
          console.log('Creating new subscription');
          const trial_end = useTrial
            ? new Date(Date.now() + plan.trial_days * 24 * 60 * 60 * 1000).toISOString()
            : null;

          const { data: newSub, error: createError } = await supabase
            .from("subscriptions")
            .insert({
              tenant_id: tenant.id,
              plan_id: plan_id,
              application_id: application_id,
              status: useTrial ? "trialing" : "active",
              period_start: new Date().toISOString(),
              period_end: periodEnd,
              current_period_start: new Date().toISOString(),
              current_period_end: periodEnd,
              trial_start: useTrial ? new Date().toISOString() : null,
              trial_end: trial_end,
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating subscription:', createError);
            return new Response(
              JSON.stringify({
                success: false,
                error: `Failed to create subscription: ${createError.message}`
              }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
          subscription = newSub;
          console.log('Subscription created:', subscription);

          const { error: tenantAppError } = await supabase
            .from("tenant_applications")
            .upsert({
              tenant_id: tenant.id,
              application_id: application_id,
              subscription_id: subscription.id,
            });

          if (tenantAppError) {
            console.error('Error upserting tenant_applications:', tenantAppError);
          }
        }

        const license_key = `${plan.name.replace(/\s+/g, '-')}-${crypto.randomUUID().split('-')[0]}`.toUpperCase();

        console.log('Creating/updating license');
        const { data: license, error: licenseError } = await supabase
          .from("licenses")
          .upsert({
            tenant_id: tenant.id,
            application_id: application_id,
            subscription_id: subscription.id,
            plan_id: plan_id,
            license_key: license_key,
            type: useTrial ? "trial" : "paid",
            status: useTrial ? "trial" : "active",
            expires_at: useTrial
              ? new Date(Date.now() + plan.trial_days * 24 * 60 * 60 * 1000).toISOString()
              : periodEnd,
          }, {
            onConflict: "tenant_id, application_id",
          })
          .select()
          .single();

        if (licenseError) {
          console.error('Error creating/updating license:', licenseError);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Failed to create/update license: ${licenseError.message}`
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        console.log('License created/updated:', license);

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              subscription,
              license,
              message: "Plan assigned successfully"
            }
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        console.error('Error in assign-plan:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : "Internal server error"
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // POST tenants/register-payment - Register a manual payment and activate subscription
    if (path === "tenants/register-payment" && method === "POST") {
      try {
        const body = await req.json();
        const { tenant_id, application_id, amount, currency, payment_method, notes } = body;

        if (!tenant_id || !application_id) {
          return new Response(
            JSON.stringify({ success: false, error: "tenant_id and application_id are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get the active/trialing subscription
        const { data: subscription, error: subError } = await supabase
          .from("subscriptions")
          .select("*, plan:plans(*)")
          .eq("tenant_id", tenant_id)
          .eq("application_id", application_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subError || !subscription) {
          return new Response(
            JSON.stringify({ success: false, error: "No subscription found for this tenant and application" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const plan = subscription.plan;
        const now = new Date();
        const periodEnd = plan.billing_cycle === "annual"
          ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

        // Insert completed payment record — triggers auto_activate_subscription_on_payment
        const { data: payment, error: paymentError } = await supabase
          .from("subscription_payments")
          .insert({
            subscription_id: subscription.id,
            tenant_id: tenant_id,
            plan_id: subscription.plan_id,
            amount: amount ?? plan.price,
            currency: currency ?? plan.currency ?? "USD",
            status: "completed",
            payment_method: payment_method ?? "manual",
            payment_provider: "manual",
            paid_at: now.toISOString(),
            period_start: now.toISOString(),
            period_end: periodEnd,
            metadata: {
              registered_by: "admin",
              notes: notes ?? null,
              registered_at: now.toISOString(),
            },
          })
          .select()
          .single();

        if (paymentError) throw paymentError;

        // Also update license to paid/active
        await supabase
          .from("licenses")
          .update({
            type: "paid",
            status: "active",
            expires_at: periodEnd,
          })
          .eq("tenant_id", tenant_id)
          .eq("application_id", application_id);

        return new Response(
          JSON.stringify({
            success: true,
            data: { payment_id: payment.id, subscription_id: subscription.id },
            message: "Payment registered and subscription activated",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error("Error in register-payment:", error);
        return new Response(
          JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Internal server error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // POST activate-trial - Activate a trial plan for a tenant or user
    // Body: { application_id, plan_id, tenant_id? | external_user_id? | user_email? }
    if (path === "activate-trial" && method === "POST") {
      try {
        const body = await req.json();
        const { application_id, plan_id, tenant_id, external_user_id, user_email } = body;

        if (!application_id || !plan_id) {
          return new Response(
            JSON.stringify({ success: false, error: "application_id and plan_id are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (!tenant_id && !external_user_id && !user_email) {
          return new Response(
            JSON.stringify({ success: false, error: "One of tenant_id, external_user_id or user_email is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Resolve tenant
        let resolvedTenantId: string | null = tenant_id ?? null;

        if (!resolvedTenantId && external_user_id) {
          const { data: owned } = await supabase.from("tenants").select("id")
            .eq("owner_user_id", external_user_id).maybeSingle();
          if (owned) resolvedTenantId = owned.id;

          if (!resolvedTenantId) {
            const { data: member } = await supabase.from("tenant_members").select("tenant_id")
              .eq("external_user_id", external_user_id).eq("application_id", application_id).maybeSingle();
            if (member) resolvedTenantId = member.tenant_id;
          }

          if (!resolvedTenantId) {
            const { data: appUser } = await supabase.from("application_users").select("tenant_id, email")
              .eq("external_user_id", external_user_id).eq("application_id", application_id).maybeSingle();
            if (appUser?.tenant_id) {
              resolvedTenantId = appUser.tenant_id;
            } else if (appUser?.email) {
              const { data: byEmail } = await supabase.from("tenants").select("id")
                .eq("owner_email", appUser.email).maybeSingle();
              if (byEmail) resolvedTenantId = byEmail.id;
            }
          }
        }

        if (!resolvedTenantId && user_email) {
          const { data: byEmail } = await supabase.from("tenants").select("id")
            .eq("owner_email", user_email).maybeSingle();
          if (byEmail) resolvedTenantId = byEmail.id;
        }

        if (!resolvedTenantId) {
          return new Response(
            JSON.stringify({ success: false, error: "Tenant not found for the provided identifiers" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Validate plan belongs to this application
        const { data: plan } = await supabase.from("plans").select("*")
          .eq("id", plan_id).eq("application_id", application_id).maybeSingle();

        if (!plan) {
          return new Response(
            JSON.stringify({ success: false, error: "Plan not found or does not belong to this application" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const now = new Date();
        const trialEnd = plan.trial_days > 0
          ? new Date(now.getTime() + plan.trial_days * 24 * 60 * 60 * 1000).toISOString()
          : null;
        const periodEnd = plan.billing_cycle === "annual"
          ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const status = trialEnd ? "trialing" : "active";

        // Upsert subscription
        const { data: existingSubs } = await supabase.from("subscriptions").select("id")
          .eq("tenant_id", resolvedTenantId).eq("application_id", application_id)
          .order("created_at", { ascending: false }).limit(1);

        let subscription: any;
        if (existingSubs && existingSubs.length > 0) {
          const { data: updated } = await supabase.from("subscriptions").update({
            plan_id,
            status,
            trial_start: trialEnd ? now.toISOString() : null,
            trial_end: trialEnd,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd,
            period_start: now.toISOString(),
            period_end: periodEnd,
          }).eq("id", existingSubs[0].id).select().single();
          subscription = updated;
        } else {
          const { data: created } = await supabase.from("subscriptions").insert({
            tenant_id: resolvedTenantId,
            application_id,
            plan_id,
            status,
            trial_start: trialEnd ? now.toISOString() : null,
            trial_end: trialEnd,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd,
            period_start: now.toISOString(),
            period_end: periodEnd,
          }).select().single();
          subscription = created;

          await supabase.from("tenant_applications").upsert({
            tenant_id: resolvedTenantId,
            application_id,
            subscription_id: subscription.id,
          });
        }

        // Upsert license
        const licenseKey = `LIC-${plan.name.replace(/\s+/g, '-').toUpperCase()}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
        await supabase.from("licenses").upsert({
          tenant_id: resolvedTenantId,
          application_id,
          subscription_id: subscription.id,
          plan_id,
          license_key: licenseKey,
          type: trialEnd ? "trial" : "paid",
          status: trialEnd ? "trial" : "active",
          expires_at: trialEnd ?? periodEnd,
        }, { onConflict: "tenant_id, application_id" });

        // Link application_users.tenant_id if needed
        if (external_user_id) {
          await supabase.from("application_users")
            .update({ tenant_id: resolvedTenantId })
            .eq("external_user_id", external_user_id)
            .eq("application_id", application_id)
            .is("tenant_id", null);
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              subscription_id: subscription.id,
              tenant_id: resolvedTenantId,
              plan_id,
              status,
              trial_end: trialEnd,
              period_end: periodEnd,
            },
            message: trialEnd
              ? `Trial activated — expires ${new Date(trialEnd).toISOString().split('T')[0]}`
              : "Plan activated",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error("Error in activate-trial:", error);
        return new Response(
          JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Internal server error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (path === "features" && method === "POST") {
      const payload = await req.json();
      const { name, code, description, value_type, category, default_value, unit, active } = payload;

      if (!name || !code) {
        return new Response(
          JSON.stringify({ success: false, error: "Name and code are required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: existingFeature } = await supabase
        .from("feature_catalog")
        .select("code")
        .eq("code", code)
        .maybeSingle();

      if (existingFeature) {
        return new Response(
          JSON.stringify({ success: false, error: "Una funcionalidad con este código ya existe" }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const insertData: any = {
        name,
        code,
        description: description || 'Funcionalidad personalizada',
        value_type: value_type || 'boolean',
        category: category || 'other',
        default_value: default_value || 'true',
        active: active !== undefined ? active : true,
      };

      if (unit) {
        insertData.unit = unit;
      }

      const { data, error } = await supabase
        .from("feature_catalog")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          data,
          message: "Funcionalidad creada exitosamente"
        }),
        {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.match(/^plans\/[0-9a-f-]+\/sync-mercadopago$/) && method === "POST") {
      const planId = path.split("/")[1];

      const { data: plan, error: planError } = await supabase
        .from("plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (planError || !plan) {
        return new Response(
          JSON.stringify({ success: false, error: "Plan not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const config = await getConfigFromAPI();

      const mercadopagoApiUrl = config.MERCADOPAGO_API_URL || "https://api.mercadopago.com/preapproval_plan";
      const mercadopagoAccessToken = config.MERCADOPAGO_ACCESS_TOKEN;
      const globalBackUrl = config.MERCADOPAGO_BACK_URL || "";

      if (!mercadopagoAccessToken || mercadopagoAccessToken === "your_mercadopago_access_token_here") {
        return new Response(
          JSON.stringify({
            success: false,
            error: "MercadoPago access token not configured. Please configure it in the app_config table."
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // The back_url sent to MercadoPago is ALWAYS this platform's /subscription-callback.
      // That endpoint resolves which app triggered the checkout (via preapproval_id → plan → app)
      // and then redirects the user to the app's own back_url with status query params.
      // MERCADOPAGO_BACK_URL is only used as a last-resort fallback when no app back_url is set.
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const platformCallbackBase = `${supabaseUrl}/functions/v1/subscription-callback`;
      const platformCallbackUrl = new URL(platformCallbackBase);
      if (plan.application_id) platformCallbackUrl.searchParams.set("app_id", plan.application_id);
      const mercadopagoBackUrl = platformCallbackUrl.toString();

      const frequency = plan.billing_cycle === "annual" ? 12 : 1;
      const frequencyType = "months";

      const mercadopagoPayload: any = {
        reason: plan.name,
        auto_recurring: {
          frequency: frequency,
          frequency_type: frequencyType,
          transaction_amount: parseFloat(plan.price),
          currency_id: "UYU", // MercadoPago Uruguay only accepts UYU
        },
        back_url: mercadopagoBackUrl
      };

      if (plan.trial_days && plan.trial_days > 0) {
        mercadopagoPayload.auto_recurring.free_trial = {
          frequency: plan.trial_days >= 30 ? Math.floor(plan.trial_days / 30) : plan.trial_days,
          frequency_type: plan.trial_days >= 30 ? "months" : "days"
        };
      }

      if (plan.billing_day && plan.billing_day >= 1 && plan.billing_day <= 28) {
        mercadopagoPayload.auto_recurring.billing_day = parseInt(plan.billing_day);
        mercadopagoPayload.auto_recurring.billing_day_proportional = true;
      }

      if (plan.external_reference && plan.external_reference.trim() !== '') {
        mercadopagoPayload.external_reference = plan.external_reference.trim();
      }

      try {
        // If plan already has an MP id, update it via PUT; otherwise create via POST
        const isUpdate = !!plan.mp_preapproval_plan_id;
        const mpUrl = isUpdate
          ? `https://api.mercadopago.com/preapproval_plan/${plan.mp_preapproval_plan_id}`
          : mercadopagoApiUrl;
        const mpMethod = isUpdate ? "PUT" : "POST";

        const mpResponse = await fetch(mpUrl, {
          method: mpMethod,
          headers: {
            "Authorization": `Bearer ${mercadopagoAccessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(mercadopagoPayload)
        });

        if (!mpResponse.ok) {
          const errorData = await mpResponse.text();
          console.error("MercadoPago API Error:", errorData);
          console.error("Request payload:", JSON.stringify(mercadopagoPayload, null, 2));

          let parsedError;
          try {
            parsedError = JSON.parse(errorData);
          } catch {
            parsedError = errorData;
          }

          return new Response(
            JSON.stringify({
              success: false,
              error: `MercadoPago API error: ${mpResponse.status}`,
              details: parsedError,
              payload: mercadopagoPayload
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const mpData = await mpResponse.json();

        const { data: updatedPlan, error: updateError } = await supabase
          .from("plans")
          .update({
            mp_preapproval_plan_id: mpData.id,
            mp_status: mpData.status,
            mp_init_point: mpData.init_point,
            mp_back_url: mpData.back_url,
            mp_collector_id: mpData.collector_id,
            mp_application_id: mpData.application_id,
            mp_date_created: mpData.date_created,
            mp_last_modified: mpData.last_modified,
            mp_response: mpData,
            updated_at: new Date().toISOString()
          })
          .eq("id", planId)
          .select()
          .single();

        if (updateError) {
          console.error("Error updating plan with MP data:", updateError);
          return new Response(
            JSON.stringify({
              success: false,
              error: "Failed to update plan with MercadoPago data",
              mp_data: mpData
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: updatedPlan,
            message: "Plan successfully synced with MercadoPago"
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        console.error("Error calling MercadoPago API:", error);
        return new Response(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : "Failed to sync with MercadoPago"
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    if (path.match(/^plans\/[0-9a-f-]+\/unsync-mercadopago$/) && method === "POST") {
      const planId = path.split("/")[1];

      const { data: plan, error: planError } = await supabase
        .from("plans")
        .select("id, name, mp_preapproval_plan_id")
        .eq("id", planId)
        .single();

      if (planError || !plan) {
        return new Response(
          JSON.stringify({ success: false, error: "Plan not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!plan.mp_preapproval_plan_id) {
        return new Response(
          JSON.stringify({ success: false, error: "Plan is not synced with MercadoPago" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateError } = await supabase
        .from("plans")
        .update({
          mp_preapproval_plan_id: null,
          mp_status: null,
          mp_init_point: null,
          mp_back_url: null,
          mp_collector_id: null,
          mp_application_id: null,
          mp_date_created: null,
          mp_last_modified: null,
          mp_response: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", planId);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ success: true, message: `Plan "${plan.name}" unsynced from MercadoPago` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Route not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Admin API Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});