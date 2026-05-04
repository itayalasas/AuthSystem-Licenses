import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const ENV_API_URL = 'https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/get-env';
const ACCESS_KEY = '033b6f38b0c5b902c90dbb1f371c389f967a0afa871028da2ab5657062cab866';

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

function loaderPage(message: string): Response {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Confirmando pago...</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f0f4f8;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,.10);
      padding: 3rem 3.5rem;
      text-align: center;
      max-width: 420px;
      width: 90%;
    }
    .spinner {
      width: 52px;
      height: 52px;
      border: 4px solid #e2e8f0;
      border-top-color: #2563eb;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
      margin: 0 auto 1.5rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 {
      font-size: 1.25rem;
      font-weight: 700;
      color: #111827;
      margin-bottom: .5rem;
    }
    p {
      font-size: .92rem;
      color: #6b7280;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h2>Confirmando tu suscripción</h2>
    <p>${message}</p>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function errorPage(detail: string): Response {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Error</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f0f4f8;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,.10);
      padding: 3rem 3.5rem;
      text-align: center;
      max-width: 420px;
      width: 90%;
    }
    .icon { font-size: 2.5rem; margin-bottom: 1rem; }
    h2 { font-size: 1.2rem; font-weight: 700; color: #111827; margin-bottom: .5rem; }
    p { font-size: .88rem; color: #6b7280; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#x26A0;&#xFE0F;</div>
    <h2>Ocurrió un problema</h2>
    <p>${detail}</p>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

Deno.serve(async (req: Request) => {
  // MercadoPago redirects via GET; we also need to handle OPTIONS for any preflight.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200 });
  }

  const url = new URL(req.url);
  const preapprovalId = url.searchParams.get("preapproval_id");
  const appId = url.searchParams.get("app_id");

  // If no meaningful params yet, just show the loader (first hit before MP appends params)
  if (!preapprovalId && !appId) {
    return loaderPage("Estamos verificando el estado de tu pago, por favor espera un momento.");
  }

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

    // Step 4 — if no redirect target, show a static result page
    const baseRedirectUrl = application?.back_url || globalBackUrl;

    if (!baseRedirectUrl) {
      const labels: Record<string, string> = {
        authorized: "Tu suscripción fue activada correctamente.",
        pending: "Tu pago está siendo procesado. Te notificaremos cuando se confirme.",
        cancelled: "La suscripción fue cancelada.",
        paused: "Tu suscripción está pausada.",
      };
      return new Response(
        `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Suscripción</title>
        <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f0f4f8}
        .card{background:white;padding:2.5rem 3rem;border-radius:14px;box-shadow:0 6px 30px rgba(0,0,0,.09);text-align:center;max-width:400px}
        h2{color:#111827;margin-bottom:.5rem}p{color:#6b7280;font-size:.92rem}</style></head>
        <body><div class="card"><h2>Suscripción procesada</h2><p>${labels[mpStatus] || "Estado: " + mpStatus}</p></div></body></html>`,
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // Step 5 — show loader page with JS auto-redirect
    const redirectUrl = new URL(baseRedirectUrl);
    redirectUrl.searchParams.set("subscription_status", mpStatus);
    if (preapprovalId) redirectUrl.searchParams.set("preapproval_id", preapprovalId);
    if (subscription?.id) redirectUrl.searchParams.set("subscription_id", subscription.id);
    if (plan?.id) redirectUrl.searchParams.set("plan_id", plan.id);
    if (plan?.name) redirectUrl.searchParams.set("plan_name", plan.name);

    const target = redirectUrl.toString();

    const statusMessages: Record<string, string> = {
      authorized: "Tu suscripción fue activada. Redirigiendo a la aplicación...",
      pending: "Tu pago está siendo procesado. Redirigiendo...",
      cancelled: "La suscripción fue cancelada. Redirigiendo...",
      paused: "Tu suscripción está pausada. Redirigiendo...",
    };
    const msg = statusMessages[mpStatus] || "Procesando tu suscripción. Redirigiendo...";

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Confirmando pago...</title>
  <meta http-equiv="refresh" content="3;url=${target}">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f0f4f8;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,.10);
      padding: 3rem 3.5rem;
      text-align: center;
      max-width: 420px;
      width: 90%;
    }
    .spinner {
      width: 52px;
      height: 52px;
      border: 4px solid #e2e8f0;
      border-top-color: #2563eb;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
      margin: 0 auto 1.5rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { font-size: 1.25rem; font-weight: 700; color: #111827; margin-bottom: .5rem; }
    p { font-size: .92rem; color: #6b7280; line-height: 1.6; }
    .link { display: inline-block; margin-top: 1.25rem; font-size: .85rem; color: #2563eb; text-decoration: none; }
    .link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h2>Confirmando tu suscripción</h2>
    <p>${msg}</p>
    <a class="link" href="${target}">Continuar ahora &rarr;</a>
  </div>
  <script>
    setTimeout(function() { window.location.href = ${JSON.stringify(target)}; }, 3000);
  </script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });

  } catch (err: any) {
    console.error("subscription-callback error:", err);
    return errorPage("Ocurrió un error al procesar tu suscripción. Por favor contacta al soporte.");
  }
});
