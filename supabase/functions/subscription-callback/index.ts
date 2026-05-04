import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const ENV_API_URL = 'https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/get-env';
const ACCESS_KEY = '033b6f38b0c5b902c90dbb1f371c389f967a0afa871028da2ab5657062cab866';

// The URL of this admin panel — used as the payment-callback page host.
// We derive it from SUPABASE_URL as a fallback, but the app's back_url takes priority.
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

    // Step 1 — check our DB first
    if (preapprovalId) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id, status, plan_id, plans(id, name, application_id), tenants(id)")
        .eq("mp_preapproval_id", preapprovalId)
        .maybeSingle();

      if (sub) {
        subscription = sub;
        plan = sub.plans;
        mpStatus = sub.status || "pending";
      }
    }

    // Step 2 — ask MP directly if not in DB yet
    if (!subscription && preapprovalId && token && token !== "your_mercadopago_access_token_here") {
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
              .select("id, name, application_id")
              .eq("mp_preapproval_plan_id", mpPlanId)
              .maybeSingle();
            plan = planData;
          }
        }
      } catch (_) {}
    }

    // Step 3 — resolve application
    const resolvedAppId = plan?.application_id || appId;
    if (resolvedAppId) {
      const { data: appData } = await supabase
        .from("applications")
        .select("id, back_url")
        .eq("id", resolvedAppId)
        .maybeSingle();
      application = appData;
    }

    // Step 4 — Build the payment-callback page URL on the admin panel
    // The admin panel hosts /payment-callback which shows the loader + redirect to the client app.
    const adminCallbackUrl = new URL(`${ADMIN_PANEL_URL}/payment-callback`);
    adminCallbackUrl.searchParams.set("subscription_status", mpStatus);
    if (preapprovalId) adminCallbackUrl.searchParams.set("preapproval_id", preapprovalId);
    if (subscription?.id) adminCallbackUrl.searchParams.set("subscription_id", subscription.id);
    if (plan?.id) adminCallbackUrl.searchParams.set("plan_id", plan.id);
    if (plan?.name) adminCallbackUrl.searchParams.set("plan_name", plan.name);

    // Pass the final destination so the frontend page can redirect the user there
    const finalDestination = application?.back_url || globalBackUrl;
    if (finalDestination) {
      adminCallbackUrl.searchParams.set("back_url", finalDestination);
    }

    return redirect(adminCallbackUrl.toString());

  } catch (err: any) {
    console.error("subscription-callback error:", err);
    // On unexpected error, redirect to admin panel root
    return redirect(`${ADMIN_PANEL_URL}/payment-callback?subscription_status=pending`);
  }
});
