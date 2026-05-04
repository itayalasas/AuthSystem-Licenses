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

async function getBackUrl(supabase: any, appId: string | null): Promise<string | null> {
  if (!appId) return null;
  const { data } = await supabase
    .from("applications")
    .select("back_url")
    .eq("id", appId)
    .maybeSingle();
  return data?.back_url || null;
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

  // Helper: resolve application_id from all available sources and return back_url
  async function resolveBackUrl(planAppId: string | null): Promise<string | null> {
    // Priority: plan.application_id > app_id param
    const id = planAppId || appId;
    return getBackUrl(supabase, id);
  }

  try {
    const config = await getConfigFromAPI();
    const token = config.MERCADOPAGO_ACCESS_TOKEN;

    let subscription: any = null;
    let plan: any = null;
    let mpStatus = "pending";
    let mpPlanId: string | null = null;

    // Step 1 — buscar suscripcion en DB por preapproval_id (camino rapido, sin llamar a MP)
    if (preapprovalId) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id, status, plan_id, tenant_id, mp_preapproval_id, plans(id, name, application_id, billing_cycle, entitlements)")
        .eq("mp_preapproval_id", preapprovalId)
        .maybeSingle();

      if (sub) {
        subscription = sub;
        plan = sub.plans;
        mpStatus = sub.status || "pending";
      }
    }

    // Step 2 — si no encontramos por preapproval_id, buscar el plan desde DB via app_id
    // y luego consultar MP para el status real
    if (!plan && appId) {
      // Buscar el plan de MP que corresponde a esta app consultando MP con el preapproval_id
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

      // Si MP no respondio o no hay token, buscar cualquier plan activo de esta app
      // para poder obtener el application_id y de ahi el back_url
      if (!plan) {
        const { data: anyPlan } = await supabase
          .from("plans")
          .select("id, name, application_id, billing_cycle, entitlements")
          .eq("application_id", appId)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        plan = anyPlan;
      }
    }

    // Step 3 — si MP dice authorized, actualizar suscripcion y licencia
    if (mpStatus === "authorized" && plan) {
      const now = new Date();
      const billingCycle = plan.billing_cycle || "monthly";
      const periodEnd = new Date(
        now.getTime() + (billingCycle === "annual" ? 365 : 30) * 24 * 60 * 60 * 1000
      );

      if (subscription) {
        await supabase
          .from("subscriptions")
          .update({
            plan_id: plan.id,
            status: "active",
            period_start: now.toISOString(),
            period_end: periodEnd.toISOString(),
            mp_preapproval_id: preapprovalId,
            payment_provider: "mercadopago",
            metadata: {
              ...((subscription as any).metadata || {}),
              mp_preapproval_id: preapprovalId,
              activated_at: now.toISOString(),
            },
          })
          .eq("id", subscription.id);

        await updateOrCreateLicense(supabase, subscription.id);
        console.log("Updated subscription:", subscription.id, "plan:", plan.id);
      } else {
        // Buscar suscripcion activa/trial para este tenant via app
        const resolvedAppId = plan.application_id || appId;
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
              payment_provider: "mercadopago",
            })
            .eq("id", subToUpdate.id);

          await updateOrCreateLicense(supabase, subToUpdate.id);
          subscription = subToUpdate;
          console.log("Linked preapproval to subscription:", subToUpdate.id);
        }
      }
    }

    // Step 4 — obtener back_url de la aplicacion en la DB
    const backUrl = await resolveBackUrl(plan?.application_id || null);

    // Step 5 — armar URL final al panel con todos los params
    const adminCallbackUrl = new URL(`${ADMIN_PANEL_URL}/payment-callback`);
    adminCallbackUrl.searchParams.set("subscription_status", mpStatus);
    if (preapprovalId) adminCallbackUrl.searchParams.set("preapproval_id", preapprovalId);
    if (subscription?.id) adminCallbackUrl.searchParams.set("subscription_id", subscription.id);
    if (plan?.id) adminCallbackUrl.searchParams.set("plan_id", plan.id);
    if (plan?.name) adminCallbackUrl.searchParams.set("plan_name", plan.name);
    if (backUrl) adminCallbackUrl.searchParams.set("back_url", backUrl);

    console.log("Redirecting to:", adminCallbackUrl.toString());
    return redirect(adminCallbackUrl.toString());

  } catch (err: any) {
    console.error("subscription-callback error:", err);

    // Incluso en error, intentar obtener back_url de la DB para no quedar atascado
    let errorBackUrl: string | null = null;
    try {
      errorBackUrl = await getBackUrl(supabase, appId);
    } catch (_) {}

    const errUrl = new URL(`${ADMIN_PANEL_URL}/payment-callback`);
    errUrl.searchParams.set("subscription_status", "pending");
    if (errorBackUrl) errUrl.searchParams.set("back_url", errorBackUrl);
    return redirect(errUrl.toString());
  }
});
