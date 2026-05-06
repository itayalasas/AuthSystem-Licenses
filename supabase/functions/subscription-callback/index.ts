import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const ADMIN_PANEL_URL = 'https://auth-license.netlify.app';

// Hardcoded until moved to secrets
const MP_ACCESS_TOKEN = 'APP_USR-6852491126052518-050319-afbaf6321b77ff2c148077e4d41fc53b-2519338363';

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

  // MP appends its own params with a second "?" instead of "&" because our back_url already
  // contains "?app_id=...". Supabase edge runtime percent-encodes the second "?" as "%3F",
  // so app_id ends up as "uuid%3Fpreapproval_id%3Dvalue" which decodes to "uuid?preapproval_id=value".
  // We handle this by splitting on the decoded "?" within param values.
  const rawAppId = url.searchParams.get("app_id") ?? "";

  let appId: string | null = null;
  let preapprovalId: string | null = url.searchParams.get("preapproval_id");

  if (rawAppId.includes('?')) {
    // The second "?" and its params got folded into the app_id value
    const [cleanAppId, embeddedQuery] = rawAppId.split('?');
    appId = cleanAppId || null;
    const embedded = new URLSearchParams(embeddedQuery);
    if (!preapprovalId) preapprovalId = embedded.get("preapproval_id");
  } else {
    appId = rawAppId || null;
  }

  console.log("req.url:", req.url);
  console.log("appId:", appId, "preapprovalId:", preapprovalId);

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
    let subscription: any = null;
    let plan: any = null;
    let mpStatus = "pending";
    let mpPlanId: string | null = null;

    // Step 1a — el preapproval_id puede ser en realidad el external_reference (= subscription.id)
    // que MP devuelve al back_url. Intentar buscarlo como subscription ID primero.
    if (preapprovalId) {
      const { data: subById } = await supabase
        .from("subscriptions")
        .select("id, status, plan_id, tenant_id, mp_preapproval_id, plans(id, name, application_id, billing_cycle, entitlements)")
        .eq("id", preapprovalId)
        .maybeSingle();

      if (subById) {
        subscription = subById;
        plan = subById.plans;
        // We found via external_reference: treat as authorized since MP confirmed payment
        mpStatus = "authorized";
        console.log("Found subscription by external_reference (subscription id):", preapprovalId);
      }
    }

    // Step 1b — buscar suscripcion en DB por mp_preapproval_id real
    if (!subscription && preapprovalId) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id, status, plan_id, tenant_id, mp_preapproval_id, plans(id, name, application_id, billing_cycle, entitlements)")
        .eq("mp_preapproval_id", preapprovalId)
        .maybeSingle();

      if (sub) {
        subscription = sub;
        plan = sub.plans;
        mpStatus = sub.status || "pending";
        console.log("Found subscription by mp_preapproval_id:", preapprovalId);
      }
    }

    // Step 2 — consultar MP para obtener status real y datos del preapproval
    if (preapprovalId) {
      try {
        const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
          headers: { "Authorization": `Bearer ${MP_ACCESS_TOKEN}` },
        });
        if (mpRes.ok) {
          const mpData = await mpRes.json();
          mpStatus = mpData.status || "pending";
          mpPlanId = mpData.preapproval_plan_id || null;
          const mpExternalRef = mpData.external_reference || null;
          const mpPayerEmail = mpData.payer_email || null;

          console.log("MP preapproval:", { mpStatus, mpPlanId, mpExternalRef, mpPayerEmail });

          // 2a — buscar suscripcion por external_reference (= subscription.id que enviamos a MP)
          if (mpExternalRef && !subscription) {
            const { data: subByRef } = await supabase
              .from("subscriptions")
              .select("id, status, plan_id, tenant_id, mp_preapproval_id, plans(id, name, application_id, billing_cycle, entitlements)")
              .eq("id", mpExternalRef)
              .maybeSingle();
            if (subByRef) {
              subscription = subByRef;
              plan = subByRef.plans;
              console.log("Found subscription by external_reference:", mpExternalRef);
            }
          }

          // 2b — buscar plan por mp_preapproval_plan_id
          if (!plan && mpPlanId) {
            const { data: planData } = await supabase
              .from("plans")
              .select("id, name, application_id, entitlements, billing_cycle")
              .eq("mp_preapproval_plan_id", mpPlanId)
              .maybeSingle();
            plan = planData;
          }

          // 2c — si tenemos plan pero no suscripcion, buscar tenant por payer_email
          if (plan && !subscription && mpPayerEmail) {
            const { data: appUser } = await supabase
              .from("application_users")
              .select("tenant_id")
              .eq("application_id", plan.application_id)
              .or(`external_user_id.eq.${mpPayerEmail},email.eq.${mpPayerEmail}`)
              .maybeSingle();

            if (appUser?.tenant_id) {
              const { data: sub } = await supabase
                .from("subscriptions")
                .select("id, status, plan_id, tenant_id, mp_preapproval_id, plans(id, name, application_id, billing_cycle, entitlements)")
                .eq("tenant_id", appUser.tenant_id)
                .in("status", ["trialing", "active", "pending"])
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              if (sub) {
                subscription = sub;
                plan = sub.plans || plan;
                console.log("Found subscription by payer_email:", mpPayerEmail);
              }
            }
          }
        } else {
          console.error("MP API error:", mpRes.status, await mpRes.text());
        }
      } catch (e) {
        console.error("MP API fetch error:", e);
      }
    }

    // Fallback: buscar plan por app_id si aun no lo tenemos
    if (!plan && appId) {
      const { data: anyPlan } = await supabase
        .from("plans")
        .select("id, name, application_id, billing_cycle, entitlements")
        .eq("application_id", appId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      plan = anyPlan;
    }

    // Step 3 — si el pago fue aprobado, actualizar suscripcion y licencia
    if (mpStatus === "authorized" && plan) {
      const now = new Date();
      const billingCycle = plan.billing_cycle || "monthly";
      const periodEnd = new Date(
        now.getTime() + (billingCycle === "annual" ? 365 : 30) * 24 * 60 * 60 * 1000
      );

      if (subscription) {
        // Actualizar la suscripcion encontrada, cambiando el plan si es necesario
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
        // No encontramos la suscripcion por subscription_id ni mp_preapproval_id.
        // Intentar encontrar el tenant via external_reference desde MP para no aplicar
        // el pago al tenant equivocado.
        console.log("Subscription not found by ID or preapproval_id — cannot safely activate without tenant context");
        // No hacemos fallback genérico. El webhook handler se encargará de reconciliar
        // cuando MP envíe la notificación con el preapproval_id correcto.
      }
    }

    // Step 4 — obtener back_url de la aplicacion en la DB
    const resolvedAppId = plan?.application_id ?? appId;
    console.log("resolvedAppId:", resolvedAppId, "plan?.application_id:", plan?.application_id, "appId:", appId);
    const backUrl = await resolveBackUrl(resolvedAppId);
    console.log("backUrl result:", backUrl);

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
