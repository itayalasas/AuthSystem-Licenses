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
            tenants_count: tenants?.length || 0,
            active_subscriptions: subscriptions?.length || 0,
            applications_count: applications?.length || 0,
            recent_tenants: recent_tenants || [],
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path === "applications" && method === "GET") {
      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const appsWithUserCount = await Promise.all(
        (data || []).map(async (app) => {
          const { count } = await supabase
            .from("application_users")
            .select("*", { count: "exact", head: true })
            .eq("application_id", app.id);

          return {
            ...app,
            users_count: count || 0,
          };
        })
      );

      return new Response(
        JSON.stringify({ success: true, data: appsWithUserCount }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.startsWith("applications/external/") && method === "GET") {
      const externalAppId = path.split("/")[2];

      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .eq("external_app_id", externalAppId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return new Response(
          JSON.stringify({ success: false, error: "Application not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { count } = await supabase
        .from("application_users")
        .select("*", { count: "exact", head: true })
        .eq("application_id", data.id);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            ...data,
            users_count: count || 0,
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path === "applications" && method === "POST") {
      const body = await req.json();
      const { name, slug, external_app_id, webhook_url, settings } = body;

      const api_key = `ak_${crypto.randomUUID().replace(/-/g, "")}`;

      const { data, error } = await supabase
        .from("applications")
        .insert({
          name,
          slug,
          external_app_id,
          api_key,
          webhook_url,
          settings: settings || {},
        })
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

    if (path.startsWith("applications/") && method === "PUT") {
      const appId = path.split("/")[1];
      const body = await req.json();

      const { data, error } = await supabase
        .from("applications")
        .update(body)
        .eq("id", appId)
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

    if (path === "tenants" && method === "GET") {
      const { data, error } = await supabase
        .from("tenants")
        .select(`
          *,
          tenant_applications (
            id,
            status,
            application:applications (
              id,
              name,
              slug
            ),
            subscription:subscriptions (
              id,
              status,
              current_period_start,
              current_period_end,
              plan:plans (
                id,
                name,
                price,
                currency
              )
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

    if (path.startsWith("tenants/") && !path.includes("/grant-access") && !path.includes("/revoke-access") && method === "GET") {
      const tenantId = path.split("/")[1];

      const { data, error } = await supabase
        .from("tenants")
        .select(`
          *,
          tenant_applications (
            id,
            status,
            application:applications (
              id,
              name,
              slug
            ),
            subscription:subscriptions (
              id,
              status,
              current_period_start,
              current_period_end,
              plan:plans (
                id,
                name,
                price,
                currency
              )
            )
          )
        `)
        .eq("id", tenantId)
        .single();

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
      const { name, organization_name, owner_user_id, owner_email, billing_email, domain, tax_id, metadata } = body;

      const { data, error } = await supabase
        .from("tenants")
        .insert({
          name,
          organization_name,
          owner_user_id,
          owner_email,
          billing_email,
          domain,
          tax_id,
          metadata: metadata || {},
        })
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

    if (path.startsWith("tenants/") && method === "PUT" && !path.includes("/grant-access") && !path.includes("/revoke-access")) {
      const tenantId = path.split("/")[1];
      const body = await req.json();

      const { data, error } = await supabase
        .from("tenants")
        .update(body)
        .eq("id", tenantId)
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

    if (path.includes("/grant-access") && method === "POST") {
      const tenantId = path.split("/")[1];
      const body = await req.json();
      const { application_id, plan_id, start_trial, notes } = body;

      let subscriptionId = null;

      if (plan_id) {
        const { data: plan } = await supabase
          .from("plans")
          .select("*")
          .eq("id", plan_id)
          .single();

        if (plan) {
          const now = new Date();
          const currentPeriodEnd = new Date(now);

          if (start_trial && plan.trial_days) {
            currentPeriodEnd.setDate(currentPeriodEnd.getDate() + plan.trial_days);
          } else if (plan.billing_cycle === "monthly") {
            currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
          } else {
            currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
          }

          const { data: subscription, error: subError } = await supabase
            .from("subscriptions")
            .insert({
              tenant_id: tenantId,
              plan_id: plan_id,
              status: start_trial ? "trialing" : "active",
              current_period_start: now.toISOString(),
              current_period_end: currentPeriodEnd.toISOString(),
              trial_end: start_trial ? currentPeriodEnd.toISOString() : null,
            })
            .select()
            .single();

          if (subError) throw subError;
          subscriptionId = subscription.id;
        }
      }

      const { data, error } = await supabase
        .from("tenant_applications")
        .insert({
          tenant_id: tenantId,
          application_id: application_id,
          subscription_id: subscriptionId,
          status: "active",
          granted_by: "admin",
          notes: notes || null,
        })
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

    if (path.includes("/revoke-access") && method === "PUT") {
      const parts = path.split("/");
      const tenantId = parts[1];
      const applicationId = parts[3];

      const { data, error } = await supabase
        .from("tenant_applications")
        .update({ status: "canceled" })
        .eq("tenant_id", tenantId)
        .eq("application_id", applicationId)
        .select()
        .single();

      if (error) throw error;

      if (data.subscription_id) {
        await supabase
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("id", data.subscription_id);
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.includes("/subscriptions/") && path.includes("/change-plan") && method === "PUT") {
      const subscriptionId = path.split("/")[1];
      const body = await req.json();
      const { plan_id } = body;

      const { data, error } = await supabase
        .from("subscriptions")
        .update({ plan_id })
        .eq("id", subscriptionId)
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

    if (path.includes("/subscriptions/") && path.includes("/status") && method === "PUT") {
      const subscriptionId = path.split("/")[1];
      const body = await req.json();
      const { status } = body;

      const { data, error } = await supabase
        .from("subscriptions")
        .update({ status })
        .eq("id", subscriptionId)
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

    if (path === "plans" && method === "GET") {
      const application_id = url.searchParams.get("application_id");

      let query = supabase.from("plans").select("*");

      if (application_id) {
        query = query.eq("application_id", application_id);
      }

      const { data, error } = await query.order("price", { ascending: true });

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

      const { data, error } = await supabase
        .from("plans")
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

      const { data, error } = await supabase
        .from("application_users")
        .select("*")
        .eq("application_id", applicationId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.match(/^applications\/[0-9a-f-]+\/assign-plan$/) && req.method === "PUT") {
      const applicationId = path.split("/")[1];
      const body = await req.json();
      const { plan_id } = body;

      const { data: plan } = await supabase
        .from("plans")
        .select("entitlements")
        .eq("id", plan_id)
        .single();

      const maxUsers = plan?.entitlements?.max_users || 0;

      const { data, error } = await supabase
        .from("applications")
        .update({
          plan_id: plan_id,
          max_users: maxUsers
        })
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

    if (path.match(/^applications\/[0-9a-f-]+$/) && req.method === "DELETE") {
      const applicationId = path.split("/")[1];

      const { error: deleteError } = await supabase
        .from("applications")
        .delete()
        .eq("id", applicationId);

      if (deleteError) throw deleteError;

      return new Response(
        JSON.stringify({ success: true, message: "Application deleted successfully" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Not found" }),
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
        error: error.message || "Internal server error",
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
