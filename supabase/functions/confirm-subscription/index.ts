import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Hardcoded until moved to secrets
const MP_ACCESS_TOKEN = "APP_USR-6852491126052518-050319-afbaf6321b77ff2c148077e4d41fc53b-2519338363";

async function updateOrCreateLicense(supabase: any, subscriptionId: string, plan: any, tenantId: string) {
  const now = new Date();
  const billingCycle = plan.billing_cycle || "monthly";
  const periodEnd = new Date(now.getTime() + (billingCycle === "annual" ? 365 : 30) * 24 * 60 * 60 * 1000);

  const { data: existing } = await supabase
    .from("licenses")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("application_id", plan.application_id)
    .maybeSingle();

  if (existing) {
    await supabase.from("licenses").update({
      plan_id: plan.id,
      type: "paid",
      status: "active",
      expires_at: periodEnd.toISOString(),
      entitlements: plan.entitlements || {},
      metadata: { last_payment_processed: now.toISOString(), plan_name: plan.name },
    }).eq("id", existing.id);
  } else {
    await supabase.from("licenses").insert({
      tenant_id: tenantId,
      subscription_id: subscriptionId,
      application_id: plan.application_id,
      plan_id: plan.id,
      license_key: `LIC-${tenantId.substring(0, 8)}-${Date.now()}`,
      type: "paid",
      status: "active",
      issued_at: now.toISOString(),
      expires_at: periodEnd.toISOString(),
      entitlements: plan.entitlements || {},
      metadata: { created_by: "confirm-subscription", plan_name: plan.name },
    });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { preapproval_id } = await req.json();

    if (!preapproval_id?.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "preapproval_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Query MercadoPago for the real status
    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapproval_id}`, {
      headers: { "Authorization": `Bearer ${MP_ACCESS_TOKEN}` },
    });

    if (!mpRes.ok) {
      const errText = await mpRes.text();
      console.error("MP API error:", mpRes.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: `MercadoPago returned ${mpRes.status}`, mp_error: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mpData = await mpRes.json();
    const mpStatus: string = mpData.status || "pending";
    const mpPlanId: string | null = mpData.preapproval_plan_id || null;
    const mpExternalRef: string | null = mpData.external_reference || null;

    console.log("MP preapproval data:", { preapproval_id, mpStatus, mpPlanId, mpExternalRef });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let subscription: any = null;
    let plan: any = null;

    // 2a. Find subscription by external_reference (= our subscription.id sent to MP)
    if (mpExternalRef) {
      const { data } = await supabase
        .from("subscriptions")
        .select("id, status, plan_id, tenant_id, mp_preapproval_id, plans(id, name, application_id, billing_cycle, entitlements)")
        .eq("id", mpExternalRef)
        .maybeSingle();
      if (data) {
        subscription = data;
        plan = data.plans;
        console.log("Found subscription by external_reference:", mpExternalRef);
      }
    }

    // 2b. Find by mp_preapproval_id already stored
    if (!subscription) {
      const { data } = await supabase
        .from("subscriptions")
        .select("id, status, plan_id, tenant_id, mp_preapproval_id, plans(id, name, application_id, billing_cycle, entitlements)")
        .eq("mp_preapproval_id", preapproval_id)
        .maybeSingle();
      if (data) {
        subscription = data;
        plan = data.plans;
        console.log("Found subscription by mp_preapproval_id:", preapproval_id);
      }
    }

    // 2c. Find plan by mp_preapproval_plan_id
    if (!plan && mpPlanId) {
      const { data } = await supabase
        .from("plans")
        .select("id, name, application_id, entitlements, billing_cycle")
        .eq("mp_preapproval_plan_id", mpPlanId)
        .maybeSingle();
      plan = data;
      console.log("Found plan by mp_preapproval_plan_id:", mpPlanId, "->", plan?.id);
    }

    // 2d. If we have a plan but no subscription, find tenant subscription by application
    if (plan && !subscription) {
      // Find the most recent pending/trialing subscription for this application
      const { data } = await supabase
        .from("subscriptions")
        .select("id, status, plan_id, tenant_id, mp_preapproval_id, plans(id, name, application_id, billing_cycle, entitlements)")
        .eq("plan_id", plan.id)
        .in("status", ["trialing", "pending", "active"])
        .is("mp_preapproval_id", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        subscription = data;
        plan = data.plans || plan;
        console.log("Found subscription by plan fallback:", data.id);
      }
    }

    // 3. Update DB if subscription found
    if (subscription && mpStatus === "authorized") {
      const now = new Date();
      const billingCycle = plan?.billing_cycle || "monthly";
      const periodEnd = new Date(now.getTime() + (billingCycle === "annual" ? 365 : 30) * 24 * 60 * 60 * 1000);

      await supabase.from("subscriptions").update({
        plan_id: plan?.id || subscription.plan_id,
        status: "active",
        period_start: now.toISOString(),
        period_end: periodEnd.toISOString(),
        mp_preapproval_id: preapproval_id,
        payment_provider: "mercadopago",
        metadata: {
          mp_preapproval_id: preapproval_id,
          mp_preapproval_plan_id: mpPlanId,
          activated_at: now.toISOString(),
          mp_status: mpStatus,
          mp_last_charged_amount: mpData.summarized?.last_charged_amount,
          mp_last_charged_date: mpData.summarized?.last_charged_date,
          mp_next_payment_date: mpData.next_payment_date,
        },
      }).eq("id", subscription.id);

      if (plan) {
        await updateOrCreateLicense(supabase, subscription.id, plan, subscription.tenant_id);
      }

      console.log("Subscription activated:", subscription.id);
    } else if (subscription && mpStatus === "cancelled") {
      await supabase.from("subscriptions").update({
        status: "canceled",
        mp_preapproval_id: preapproval_id,
        canceled_at: new Date().toISOString(),
      }).eq("id", subscription.id);
    }

    // 4. Get back_url from the application
    let backUrl: string | null = null;
    const appId = plan?.application_id;
    if (appId) {
      const { data: app } = await supabase
        .from("applications")
        .select("back_url")
        .eq("id", appId)
        .maybeSingle();
      backUrl = app?.back_url || null;
    }

    return new Response(
      JSON.stringify({
        success: true,
        mp_status: mpStatus,
        subscription_id: subscription?.id || null,
        plan_id: plan?.id || null,
        plan_name: plan?.name || mpData.reason || null,
        back_url: backUrl,
        mp_data: {
          status: mpData.status,
          reason: mpData.reason,
          next_payment_date: mpData.next_payment_date,
          last_charged_amount: mpData.summarized?.last_charged_amount,
          last_charged_date: mpData.summarized?.last_charged_date,
          auto_recurring: mpData.auto_recurring,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("confirm-subscription error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
