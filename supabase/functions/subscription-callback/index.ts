import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const ENV_API_URL = 'https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/get-env';
const ACCESS_KEY = '033b6f38b0c5b902c90dbb1f371c389f967a0afa871028da2ab5657062cab866';

const ADMIN_PANEL_URL = 'https://auth-license.netlify.app';

async function getConfigFromAPI(): Promise<Record<string, string>> {
  try {
    const response = await fetch(ENV_API_URL, {
      headers: { 'X-Access-Key': ACCESS_KEY },
    });
    if (!response.ok) return {};
    const data = await response.json();
    return data.variables || {};
  } catch {
    return {};
  }
}

function redirect(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: location },
  });
}

async function updateOrCreateLicense(supabase: any, subscriptionId: string) {
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*, plan:plans(*), tenant:tenants(*)')
    .eq('id', subscriptionId)
    .maybeSingle();

  if (!subscription || !subscription.plan) return;

  const now = new Date();
  const periodEnd = subscription.period_end
    ? new Date(subscription.period_end)
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { data: existingLicense } = await supabase
    .from('licenses')
    .select('*')
    .eq('tenant_id', subscription.tenant_id)
    .eq('application_id', subscription.plan.application_id)
    .maybeSingle();

  if (existingLicense) {
    await supabase
      .from('licenses')
      .update({
        plan_id: subscription.plan_id,
        type: 'paid',
        status: 'active',
        expires_at: periodEnd.toISOString(),
        entitlements: subscription.plan.entitlements || {},
        metadata: {
          ...existingLicense.metadata,
          last_payment_processed: now.toISOString(),
          plan_name: subscription.plan.name,
        },
      })
      .eq('id', existingLicense.id);
  } else {
    await supabase
      .from('licenses')
      .insert({
        tenant_id: subscription.tenant_id,
        subscription_id: subscriptionId,
        application_id: subscription.plan.application_id,
        plan_id: subscription.plan_id,
        license_key: `LIC-${subscription.tenant_id.substring(0, 8)}-${Date.now()}`,
        type: 'paid',
        status: 'active',
        issued_at: now.toISOString(),
        expires_at: periodEnd.toISOString(),
        entitlements: subscription.plan.entitlements || {},
        metadata: {
          created_by: 'subscription-callback',
          plan_name: subscription.plan.name,
        },
      });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200 });
  }

  const url = new URL(req.url);
  const preapprovalId = url.searchParams.get("preapproval_id");
  const appId = url.searchParams.get("app_id");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const config = await getConfigFromAPI();
    const token = config.MERCADOPAGO_ACCESS_TOKEN;
    const globalBackUrl = config.MERCADOPAGO_BACK_URL || "";

    let subscription: any = null;
    let plan: any = null;
    let application: any = null;
    let mpStatus = "pending";
    let mpPlanId: string | null = null;

    // Step 1 — query MP directly to get authoritative status
    if (preapprovalId && token && token !== "your_mercadopago_access_token_here") {
      try {
        const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
          headers: { "Authorization": `Bearer ${token}` },
        });
        if (mpRes.ok) {
          const mpData = await mpRes.json();
          mpStatus = mpData.status || "pending";
          mpPlanId = mpData.preapproval_plan_id || null;

          if (mpPlanId) {
            const { data: planData } = await supabase
              .from("plans")
              .select("id, name, application_id, entitlements, billing_cycle")
              .eq("mp_preapproval_plan_id", mpPlanId)
              .maybeSingle();
            plan = planData;
          }
        }
      } catch (e) {
        console.error("MP API error:", e);
      }
    }

    // Step 2 — check our DB for existing subscription by preapproval_id
    if (preapprovalId) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id, status, plan_id, tenant_id, plans(id, name, application_id)")
        .eq("mp_preapproval_id", preapprovalId)
        .maybeSingle();

      if (sub) {
        subscription = sub;
        if (!plan) plan = sub.plans;
        if (!mpStatus || mpStatus === "pending") mpStatus = sub.status || "pending";
      }
    }

    // Step 3 — if MP says authorized, update/create subscription and license
    if (mpStatus === "authorized" && plan) {
      const resolvedAppId = plan.application_id;
      const now = new Date();
      const billingCycle = plan.billing_cycle || "monthly";
      const periodEnd = new Date(
        now.getTime() + (billingCycle === "annual" ? 365 : 30) * 24 * 60 * 60 * 1000
      );

      if (subscription) {
        // Update existing subscription: new plan + active status + store preapproval_id
        await supabase
          .from("subscriptions")
          .update({
            plan_id: plan.id,
            status: "active",
            period_start: now.toISOString(),
            period_end: periodEnd.toISOString(),
            mp_preapproval_id: preapprovalId,
            metadata: {
              ...((subscription as any).metadata || {}),
              mp_preapproval_id: preapprovalId,
              upgraded_at: now.toISOString(),
            },
          })
          .eq("id", subscription.id);

        await updateOrCreateLicense(supabase, subscription.id);
        console.log("Updated subscription:", subscription.id, "to plan:", plan.id);
      } else {
        // No subscription found by preapproval_id — try to find by app_id and update
        // This handles the case where the subscription was created without preapproval_id yet
        if (appId) {
          const { data: appData } = await supabase
            .from("applications")
            .select("id")
            .eq("id", appId)
            .maybeSingle();

          if (appData) {
            // Find any active/trialing subscription for this application's tenants
            // that matches the plan — update the one without preapproval_id
            const { data: subToUpdate } = await supabase
              .from("subscriptions")
              .select("id, tenant_id")
              .eq("plan_id", plan.id)
              .is("mp_preapproval_id", null)
              .in("status", ["trialing", "active", "pending"])
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (subToUpdate) {
              await supabase
                .from("subscriptions")
                .update({
                  status: "active",
                  period_start: now.toISOString(),
                  period_end: periodEnd.toISOString(),
                  mp_preapproval_id: preapprovalId,
                })
                .eq("id", subToUpdate.id);

              await updateOrCreateLicense(supabase, subToUpdate.id);
              subscription = subToUpdate;
              console.log("Linked preapproval to subscription:", subToUpdate.id);
            }
          }
        }
      }
    }

    // Step 4 — resolve application for back_url
    const resolvedAppId = plan?.application_id || appId;
    if (resolvedAppId) {
      const { data: appData } = await supabase
        .from("applications")
        .select("id, back_url")
        .eq("id", resolvedAppId)
        .maybeSingle();
      application = appData;
    }

    // Step 5 — Redirect to admin panel /payment-callback with all context
    const adminCallbackUrl = new URL(`${ADMIN_PANEL_URL}/payment-callback`);
    adminCallbackUrl.searchParams.set("subscription_status", mpStatus);
    if (preapprovalId) adminCallbackUrl.searchParams.set("preapproval_id", preapprovalId);
    if (subscription?.id) adminCallbackUrl.searchParams.set("subscription_id", subscription.id);
    if (plan?.id) adminCallbackUrl.searchParams.set("plan_id", plan.id);
    if (plan?.name) adminCallbackUrl.searchParams.set("plan_name", plan.name);

    const finalDestination = application?.back_url || globalBackUrl;
    if (finalDestination) {
      adminCallbackUrl.searchParams.set("back_url", finalDestination);
    }

    return redirect(adminCallbackUrl.toString());

  } catch (err: any) {
    console.error("subscription-callback error:", err);
    return redirect(`${ADMIN_PANEL_URL}/payment-callback?subscription_status=pending`);
  }
});
