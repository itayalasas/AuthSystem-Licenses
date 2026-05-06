import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    console.log("[confirm-subscription] START preapproval_id:", preapproval_id);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get MP access token from app_config.variables jsonb
    const { data: mpConfig } = await supabase
      .from("app_config")
      .select("variables")
      .limit(1)
      .maybeSingle();

    const mpAccessToken = mpConfig?.variables?.["MERCADOPAGO_ACCESS_TOKEN"];
    console.log("[confirm-subscription] MP token prefix:", mpAccessToken?.substring(0, 15));
    if (!mpAccessToken) {
      console.error("[confirm-subscription] No MERCADOPAGO_ACCESS_TOKEN in app_config.variables");
      return new Response(
        JSON.stringify({ success: false, error: "MercadoPago access token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Query MercadoPago for the real status
    console.log("[confirm-subscription] Calling MP API...");
    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapproval_id}`, {
      headers: { "Authorization": `Bearer ${mpAccessToken}` },
    });

    if (!mpRes.ok) {
      const errText = await mpRes.text();
      console.error("[confirm-subscription] MP API error:", mpRes.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: `MercadoPago returned ${mpRes.status}`, detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mpData = await mpRes.json();
    const mpStatus: string = mpData.status || "pending";
    const mpPlanId: string | null = mpData.preapproval_plan_id || null;
    const mpReason: string | null = mpData.reason || null;

    console.log("[confirm-subscription] MP response:", JSON.stringify({
      id: mpData.id,
      status: mpStatus,
      reason: mpReason,
      preapproval_plan_id: mpPlanId,
    }));

    // 3. Find subscription — try multiple strategies
    let subscription: any = null;
    let plan: any = null;

    // Strategy A: already has this mp_preapproval_id stored
    {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, status, plan_id, tenant_id, application_id, mp_preapproval_id")
        .eq("mp_preapproval_id", preapproval_id)
        .maybeSingle();
      if (error) console.error("[confirm-subscription] Strategy A error:", error.message);
      if (data) {
        subscription = data;
        console.log("[confirm-subscription] Found via Strategy A (mp_preapproval_id):", data.id);
      }
    }

    // Strategy B: subscription whose plan matches mp_preapproval_plan_id
    if (!subscription && mpPlanId) {
      const { data: planData } = await supabase
        .from("plans")
        .select("id, name, application_id, billing_cycle, entitlements")
        .eq("mp_preapproval_plan_id", mpPlanId)
        .maybeSingle();

      if (planData) {
        plan = planData;
        console.log("[confirm-subscription] Plan found by mp_preapproval_plan_id:", planData.id, planData.name);

        // Find most recent trialing/pending subscription for this plan without a preapproval
        const { data, error } = await supabase
          .from("subscriptions")
          .select("id, status, plan_id, tenant_id, application_id, mp_preapproval_id")
          .eq("plan_id", planData.id)
          .in("status", ["trialing", "pending", "active"])
          .is("mp_preapproval_id", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) console.error("[confirm-subscription] Strategy B sub error:", error.message);
        if (data) {
          subscription = data;
          console.log("[confirm-subscription] Found via Strategy B (plan match):", data.id);
        }
      } else {
        console.warn("[confirm-subscription] mp_preapproval_plan_id not found in DB:", mpPlanId);
      }
    }

    // Strategy C: match by plan name (reason field from MP) + application
    if (!subscription && mpReason) {
      const { data: planData } = await supabase
        .from("plans")
        .select("id, name, application_id, billing_cycle, entitlements")
        .ilike("name", mpReason)
        .maybeSingle();

      if (planData) {
        plan = planData;
        console.log("[confirm-subscription] Plan found by name/reason:", planData.id, planData.name);

        const { data, error } = await supabase
          .from("subscriptions")
          .select("id, status, plan_id, tenant_id, application_id, mp_preapproval_id")
          .eq("plan_id", planData.id)
          .in("status", ["trialing", "pending"])
          .is("mp_preapproval_id", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) console.error("[confirm-subscription] Strategy C sub error:", error.message);
        if (data) {
          subscription = data;
          console.log("[confirm-subscription] Found via Strategy C (name match):", data.id);
        }
      }
    }

    if (!subscription) {
      console.warn("[confirm-subscription] No subscription found for preapproval_id:", preapproval_id);
    }

    // 4. Fetch plan for the subscription if not yet resolved
    if (subscription && !plan) {
      const { data: planData } = await supabase
        .from("plans")
        .select("id, name, application_id, billing_cycle, entitlements")
        .eq("id", subscription.plan_id)
        .maybeSingle();
      plan = planData;
      console.log("[confirm-subscription] Plan fetched from subscription.plan_id:", plan?.id, plan?.name);
    }

    // 5. Update DB based on MP status
    if (subscription) {
      const now = new Date();

      if (mpStatus === "authorized") {
        const billingCycle = plan?.billing_cycle || "monthly";
        const daysToAdd = billingCycle === "annual" ? 365 : 30;
        const periodEnd = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

        const updatePayload = {
          status: "active",
          mp_preapproval_id: preapproval_id,
          payment_provider: "mercadopago",
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
          metadata: {
            mp_preapproval_id: preapproval_id,
            mp_preapproval_plan_id: mpPlanId,
            activated_at: now.toISOString(),
            mp_status: mpStatus,
            mp_last_charged_amount: mpData.summarized?.last_charged_amount,
            mp_last_charged_date: mpData.summarized?.last_charged_date,
            mp_next_payment_date: mpData.next_payment_date,
          },
        };

        console.log("[confirm-subscription] Updating subscription to active:", subscription.id);
        const { error: updateError } = await supabase
          .from("subscriptions")
          .update(updatePayload)
          .eq("id", subscription.id);

        if (updateError) {
          console.error("[confirm-subscription] UPDATE ERROR:", updateError.message, updateError.details);
        } else {
          console.log("[confirm-subscription] Subscription updated to active OK");

          // Update or create license
          if (plan) {
            await upsertLicense(supabase, subscription, plan, preapproval_id, periodEnd);
          }
        }
      } else if (mpStatus === "cancelled") {
        const { error: updateError } = await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
            mp_preapproval_id: preapproval_id,
            canceled_at: now.toISOString(),
          })
          .eq("id", subscription.id);

        if (updateError) {
          console.error("[confirm-subscription] Cancel UPDATE ERROR:", updateError.message);
        } else {
          console.log("[confirm-subscription] Subscription cancelled OK");
        }
      } else {
        // For pending/paused just store the preapproval_id
        await supabase
          .from("subscriptions")
          .update({ mp_preapproval_id: preapproval_id })
          .eq("id", subscription.id);
        console.log("[confirm-subscription] Stored preapproval_id on subscription (status:", mpStatus, ")");
      }
    }

    // 6. Get back_url from application
    let backUrl: string | null = null;
    const appId = plan?.application_id || subscription?.application_id;
    if (appId) {
      const { data: app } = await supabase
        .from("applications")
        .select("back_url")
        .eq("id", appId)
        .maybeSingle();
      backUrl = app?.back_url || null;
      console.log("[confirm-subscription] back_url from application:", backUrl);
    }

    console.log("[confirm-subscription] DONE. mp_status:", mpStatus, "subscription:", subscription?.id);

    return new Response(
      JSON.stringify({
        success: true,
        mp_status: mpStatus,
        subscription_id: subscription?.id || null,
        plan_id: plan?.id || null,
        plan_name: plan?.name || mpReason || null,
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
    console.error("[confirm-subscription] UNHANDLED ERROR:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function upsertLicense(
  supabase: any,
  subscription: any,
  plan: any,
  preapprovalId: string,
  periodEnd: Date
) {
  const { data: existing } = await supabase
    .from("licenses")
    .select("id")
    .eq("tenant_id", subscription.tenant_id)
    .eq("application_id", plan.application_id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("licenses").update({
      plan_id: plan.id,
      type: "paid",
      status: "active",
      expires_at: periodEnd.toISOString(),
      entitlements: plan.entitlements || {},
      metadata: {
        mp_preapproval_id: preapprovalId,
        last_payment_processed: new Date().toISOString(),
        plan_name: plan.name,
      },
    }).eq("id", existing.id);
    if (error) console.error("[confirm-subscription] License UPDATE error:", error.message);
    else console.log("[confirm-subscription] License updated OK:", existing.id);
  } else {
    const licenseKey = `LIC-${subscription.tenant_id.substring(0, 8).toUpperCase()}-${Date.now()}`;
    const { error } = await supabase.from("licenses").insert({
      tenant_id: subscription.tenant_id,
      subscription_id: subscription.id,
      application_id: plan.application_id,
      plan_id: plan.id,
      license_key: licenseKey,
      type: "paid",
      status: "active",
      issued_at: new Date().toISOString(),
      expires_at: periodEnd.toISOString(),
      entitlements: plan.entitlements || {},
      metadata: {
        mp_preapproval_id: preapprovalId,
        created_by: "confirm-subscription",
        plan_name: plan.name,
      },
    });
    if (error) console.error("[confirm-subscription] License INSERT error:", error.message);
    else console.log("[confirm-subscription] License created OK");
  }
}
