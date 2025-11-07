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
      const body = await req.json();
      const { external_user_id, plan_id, application_id } = body;

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

      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("id")
        .eq("owner_user_id", external_user_id)
        .maybeSingle();

      if (tenantError) throw tenantError;

      if (!tenant) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "No tenant found for this user. Please create a tenant first."
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: plan, error: planError } = await supabase
        .from("plans")
        .select("*")
        .eq("id", plan_id)
        .eq("application_id", application_id)
        .maybeSingle();

      if (planError) throw planError;

      if (!plan) {
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

      const { data: existingSubscription, error: existingSubError } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("application_id", application_id)
        .maybeSingle();

      if (existingSubError) throw existingSubError;

      let subscription;

      if (existingSubscription) {
        const { data: updatedSub, error: updateError } = await supabase
          .from("subscriptions")
          .update({
            plan_id: plan_id,
            status: plan.trial_days > 0 ? "trialing" : "active",
            trial_start: plan.trial_days > 0 ? new Date().toISOString() : null,
            trial_end: plan.trial_days > 0
              ? new Date(Date.now() + plan.trial_days * 24 * 60 * 60 * 1000).toISOString()
              : null,
          })
          .eq("id", existingSubscription.id)
          .select()
          .single();

        if (updateError) throw updateError;
        subscription = updatedSub;
      } else {
        const trial_end = plan.trial_days > 0
          ? new Date(Date.now() + plan.trial_days * 24 * 60 * 60 * 1000).toISOString()
          : null;

        const period_end = plan.billing_cycle === "annual"
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const { data: newSub, error: createError } = await supabase
          .from("subscriptions")
          .insert({
            tenant_id: tenant.id,
            plan_id: plan_id,
            application_id: application_id,
            status: plan.trial_days > 0 ? "trialing" : "active",
            period_start: new Date().toISOString(),
            period_end: period_end,
            current_period_start: new Date().toISOString(),
            current_period_end: period_end,
            trial_start: plan.trial_days > 0 ? new Date().toISOString() : null,
            trial_end: trial_end,
          })
          .select()
          .single();

        if (createError) throw createError;
        subscription = newSub;

        await supabase
          .from("tenant_applications")
          .upsert({
            tenant_id: tenant.id,
            application_id: application_id,
            subscription_id: subscription.id,
          });
      }

      const license_key = `${plan.name.replace(/\s+/g, '-')}-${crypto.randomUUID().split('-')[0]}`.toUpperCase();

      const { data: license, error: licenseError } = await supabase
        .from("licenses")
        .upsert({
          tenant_id: tenant.id,
          application_id: application_id,
          plan_id: plan_id,
          license_key: license_key,
          status: plan.trial_days > 0 ? "trial" : "active",
          expires_at: plan.trial_days > 0
            ? new Date(Date.now() + plan.trial_days * 24 * 60 * 60 * 1000).toISOString()
            : (plan.billing_cycle === "annual"
                ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
                : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()),
        }, {
          onConflict: "tenant_id, application_id",
        })
        .select()
        .single();

      if (licenseError) throw licenseError;

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
      const mercadopagoBackUrl = config.MERCADOPAGO_BACK_URL || "https://www.yoursite.com";

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

      const frequencyType = plan.billing_cycle === "annual" ? "months" : "months";
      const frequency = plan.billing_cycle === "annual" ? 12 : 1;
      const repetitions = plan.billing_cycle === "annual" ? 1 : 12;

      const mercadopagoPayload: any = {
        reason: plan.name,
        auto_recurring: {
          frequency: frequency,
          frequency_type: frequencyType,
          transaction_amount: parseFloat(plan.price),
          currency_id: plan.currency || "UYU"
        },
        back_url: mercadopagoBackUrl
      };

      if (plan.trial_days && plan.trial_days > 0) {
        mercadopagoPayload.auto_recurring.free_trial = {
          frequency: plan.trial_days >= 30 ? Math.floor(plan.trial_days / 30) : plan.trial_days,
          frequency_type: plan.trial_days >= 30 ? "months" : "days"
        };
      }

      if (plan.billing_day && plan.billing_day >= 1 && plan.billing_day <= 31) {
        mercadopagoPayload.auto_recurring.billing_day = parseInt(plan.billing_day);
      }

      if (plan.external_reference && plan.external_reference.trim() !== '') {
        mercadopagoPayload.external_reference = plan.external_reference.trim();
      }

      try {
        const mpResponse = await fetch(mercadopagoApiUrl, {
          method: "POST",
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