import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Admin-Token",
};

const ADMIN_TOKEN = "admin_001";

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

      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .insert({
          name: body.name,
          owner_user_id: body.owner_user_id,
          external_tenant_id: body.external_tenant_id || null,
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

      return new Response(
        JSON.stringify({ success: true, data }),
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

      const { data: plan, error } = await supabase
        .from("plans")
        .insert(body)
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

      const { error } = await supabase
        .from("plans")
        .delete()
        .eq("id", planId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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

      const { data: users, error } = await supabase
        .from("application_users")
        .select("*")
        .eq("application_id", applicationId)
        .order("created_at", { ascending: false });

      if (error) throw error;

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
        JSON.stringify({ success: true, data: enrichedUsers }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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