import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const ADMIN_PANEL_URL = "https://auth-license.netlify.app";
const MP_ACCESS_TOKEN = "APP_USR-6852491126052518-050319-afbaf6321b77ff2c148077e4d41fc53b-2519338363";

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200 });
  }

  const url = new URL(req.url);
  const rawAppId = url.searchParams.get("app_id") ?? "";

  // MP sometimes folds a second "?" into the app_id value (percent-encoded as %3F)
  let appId: string | null = null;
  let preapprovalId: string | null = url.searchParams.get("preapproval_id");

  if (rawAppId.includes("?")) {
    const [cleanId, embedded] = rawAppId.split("?");
    appId = cleanId || null;
    if (!preapprovalId) preapprovalId = new URLSearchParams(embedded).get("preapproval_id");
  } else {
    appId = rawAppId || null;
  }

  console.log("appId:", appId, "preapprovalId:", preapprovalId);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Fallback redirect to admin panel with error
  const errorRedirect = (status = "pending") => {
    const u = new URL(`${ADMIN_PANEL_URL}/payment-callback`);
    u.searchParams.set("subscription_status", status);
    return redirect(u.toString());
  };

  if (!preapprovalId) {
    console.error("No preapproval_id in callback");
    return errorRedirect();
  }

  try {
    // ── Step 1: Fetch preapproval details from MercadoPago ──────────────────
    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });

    if (!mpRes.ok) {
      const body = await mpRes.text();
      console.error("MP API error:", mpRes.status, body);
      return errorRedirect();
    }

    const mp = await mpRes.json();
    const mpStatus: string = mp.status;                          // authorized | cancelled | pending | paused
    const mpReason: string | null = mp.reason || null;           // plan name e.g. "Starter"
    const mpPlanId: string | null = mp.preapproval_plan_id || null;
    const mpNextPayment: string | null = mp.next_payment_date || null;
    const mpLastChargedAmount: number | null = mp.summarized?.last_charged_amount || null;
    const mpLastChargedDate: string | null = mp.summarized?.last_charged_date || null;
    const mpTransactionAmount: number | null = mp.auto_recurring?.transaction_amount || null;

    console.log("MP data:", { id: mp.id, status: mpStatus, reason: mpReason, preapproval_plan_id: mpPlanId });

    // ── Step 2: Resolve plan from DB ────────────────────────────────────────
    // Priority: exact mp_preapproval_plan_id match → name match → any plan for app
    let plan: any = null;

    if (mpPlanId) {
      const { data } = await supabase
        .from("plans")
        .select("id, name, application_id, billing_cycle, entitlements")
        .eq("mp_preapproval_plan_id", mpPlanId)
        .maybeSingle();
      plan = data;
      if (plan) console.log("Plan found by mp_preapproval_plan_id:", plan.id, plan.name);
    }

    if (!plan && mpReason) {
      const { data } = await supabase
        .from("plans")
        .select("id, name, application_id, billing_cycle, entitlements")
        .ilike("name", mpReason.trim())
        .maybeSingle();
      plan = data;
      if (plan) console.log("Plan found by reason/name:", plan.id, plan.name);
    }

    if (!plan && appId) {
      // Last resort: most recently active plan for this app
      const { data } = await supabase
        .from("plans")
        .select("id, name, application_id, billing_cycle, entitlements")
        .eq("application_id", appId)
        .limit(1)
        .maybeSingle();
      plan = data;
      if (plan) console.log("Plan found by application_id fallback:", plan.id, plan.name);
    }

    if (!plan) {
      console.error("No plan found. mpPlanId:", mpPlanId, "reason:", mpReason, "appId:", appId);
      return errorRedirect(mpStatus);
    }

    // ── Step 3: Resolve subscription ────────────────────────────────────────
    // Priority: already has this preapproval_id → most recent trialing without preapproval_id
    let subscription: any = null;

    const { data: byPreapproval } = await supabase
      .from("subscriptions")
      .select("id, status, plan_id, tenant_id, application_id, mp_preapproval_id, metadata")
      .eq("mp_preapproval_id", preapprovalId)
      .maybeSingle();

    if (byPreapproval) {
      subscription = byPreapproval;
      console.log("Subscription found by existing mp_preapproval_id:", subscription.id);
    }

    if (!subscription) {
      // Find the most recent trialing subscription for this plan that hasn't been linked yet
      const { data: byPlan } = await supabase
        .from("subscriptions")
        .select("id, status, plan_id, tenant_id, application_id, mp_preapproval_id, metadata")
        .eq("plan_id", plan.id)
        .in("status", ["trialing", "pending"])
        .is("mp_preapproval_id", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (byPlan) {
        subscription = byPlan;
        console.log("Subscription found by plan (most recent trialing):", subscription.id);
      }
    }

    if (!subscription && plan.application_id) {
      // Fallback: any trialing subscription for this application
      const { data: byApp } = await supabase
        .from("subscriptions")
        .select("id, status, plan_id, tenant_id, application_id, mp_preapproval_id, metadata")
        .eq("application_id", plan.application_id)
        .in("status", ["trialing", "pending"])
        .is("mp_preapproval_id", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (byApp) {
        subscription = byApp;
        console.log("Subscription found by application fallback:", subscription.id);
      }
    }

    if (!subscription) {
      console.error("No subscription found for plan:", plan.id);
      // Still redirect with status so UI shows correct state
      const u = new URL(`${ADMIN_PANEL_URL}/payment-callback`);
      u.searchParams.set("subscription_status", mpStatus);
      u.searchParams.set("plan_id", plan.id);
      u.searchParams.set("plan_name", plan.name);
      const { data: app } = await supabase.from("applications").select("back_url").eq("id", plan.application_id).maybeSingle();
      if (app?.back_url) u.searchParams.set("back_url", app.back_url);
      return redirect(u.toString());
    }

    // ── Step 4: Update subscription and license ──────────────────────────────
    const now = new Date();
    const billingCycle = plan.billing_cycle || "monthly";
    const daysToAdd = billingCycle === "annual" ? 365 : 30;
    const periodEnd = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

    let newStatus: string;
    switch (mpStatus) {
      case "authorized": newStatus = "active"; break;
      case "cancelled":  newStatus = "canceled"; break;
      case "paused":     newStatus = "paused"; break;
      default:           newStatus = "pending"; break;
    }

    const updatePayload: Record<string, any> = {
      mp_preapproval_id: preapprovalId,
      plan_id: plan.id,
      status: newStatus,
      payment_provider: "mercadopago",
      metadata: {
        ...(subscription.metadata || {}),
        mp_preapproval_id: preapprovalId,
        mp_preapproval_plan_id: mpPlanId,
        mp_status: mpStatus,
        mp_reason: mpReason,
        mp_last_charged_amount: mpLastChargedAmount,
        mp_last_charged_date: mpLastChargedDate,
        mp_transaction_amount: mpTransactionAmount,
        mp_next_payment_date: mpNextPayment,
        last_updated: now.toISOString(),
      },
    };

    if (newStatus === "active") {
      updatePayload.period_start = now.toISOString();
      updatePayload.period_end = periodEnd.toISOString();
    }
    if (newStatus === "canceled") {
      updatePayload.canceled_at = now.toISOString();
    }

    const { error: subUpdateError } = await supabase
      .from("subscriptions")
      .update(updatePayload)
      .eq("id", subscription.id);

    if (subUpdateError) {
      console.error("Subscription update error:", subUpdateError.message, subUpdateError.details);
    } else {
      console.log("Subscription updated OK:", subscription.id, "→", newStatus);
    }

    // Update or create license when active
    if (newStatus === "active") {
      const { data: existingLicense } = await supabase
        .from("licenses")
        .select("id")
        .eq("tenant_id", subscription.tenant_id)
        .eq("application_id", plan.application_id)
        .maybeSingle();

      if (existingLicense) {
        const { error: licErr } = await supabase
          .from("licenses")
          .update({
            plan_id: plan.id,
            type: "paid",
            status: "active",
            expires_at: periodEnd.toISOString(),
            entitlements: plan.entitlements || {},
            metadata: { mp_preapproval_id: preapprovalId, last_payment: now.toISOString(), plan_name: plan.name },
          })
          .eq("id", existingLicense.id);
        if (licErr) console.error("License update error:", licErr.message);
        else console.log("License updated OK:", existingLicense.id);
      } else {
        const licenseKey = `LIC-${subscription.tenant_id.substring(0, 8).toUpperCase()}-${Date.now()}`;
        const { error: licErr } = await supabase
          .from("licenses")
          .insert({
            tenant_id: subscription.tenant_id,
            subscription_id: subscription.id,
            application_id: plan.application_id,
            plan_id: plan.id,
            license_key: licenseKey,
            type: "paid",
            status: "active",
            issued_at: now.toISOString(),
            expires_at: periodEnd.toISOString(),
            entitlements: plan.entitlements || {},
            metadata: { mp_preapproval_id: preapprovalId, created_by: "subscription-callback", plan_name: plan.name },
          });
        if (licErr) console.error("License insert error:", licErr.message);
        else console.log("License created OK");
      }
    }

    // ── Step 5: Get back_url and redirect ───────────────────────────────────
    const resolvedAppId = plan.application_id || appId;
    const { data: appData } = await supabase
      .from("applications")
      .select("back_url")
      .eq("id", resolvedAppId)
      .maybeSingle();

    const backUrl = appData?.back_url || null;
    console.log("back_url:", backUrl);

    const finalUrl = new URL(`${ADMIN_PANEL_URL}/payment-callback`);
    finalUrl.searchParams.set("subscription_status", mpStatus);
    finalUrl.searchParams.set("preapproval_id", preapprovalId);
    finalUrl.searchParams.set("subscription_id", subscription.id);
    finalUrl.searchParams.set("plan_id", plan.id);
    finalUrl.searchParams.set("plan_name", plan.name);
    if (backUrl) finalUrl.searchParams.set("back_url", backUrl);

    console.log("Redirecting to:", finalUrl.toString());
    return redirect(finalUrl.toString());

  } catch (err: any) {
    console.error("Unhandled error:", err);
    return errorRedirect();
  }
});
