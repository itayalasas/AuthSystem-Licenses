import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const path = url.pathname.replace('/recurring-subscriptions', '');

    // POST /create-subscription - Create a recurring subscription for a user
    if (path === '/create-subscription' && req.method === 'POST') {
      const body = await req.json();
      const { external_user_id, external_app_id, payer_email } = body;

      console.log('Create subscription request:', { external_user_id, external_app_id, payer_email });

      if (!external_user_id || !external_app_id || !payer_email) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Missing required fields: external_user_id, external_app_id, payer_email"
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Find the application
      const { data: application } = await supabase
        .from("applications")
        .select("id, name")
        .eq("external_app_id", external_app_id)
        .maybeSingle();

      if (!application) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Application not found"
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Find the user's subscription
      const { data: appUser } = await supabase
        .from("application_users")
        .select("*, tenant:tenants(*)")
        .eq("external_user_id", external_user_id)
        .eq("application_id", application.id)
        .maybeSingle();

      if (!appUser || !appUser.tenant) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "User not found in this application"
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Find the subscription
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("*, plan:plans(*)")
        .eq("tenant_id", appUser.tenant_id)
        .eq("application_id", application.id)
        .order("created_at", { ascending: false })
        .maybeSingle();

      if (!subscription) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "No subscription found for this user"
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check if subscription already has a provider_subscription_id
      if (subscription.provider_subscription_id) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "User already has an active payment method registered"
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Get MercadoPago config
      const config = await getConfigFromAPI();
      const mpAccessToken = config.MERCADOPAGO_ACCESS_TOKEN || Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
      const mpBackUrl = config.MERCADOPAGO_BACK_URL || Deno.env.get('MERCADOPAGO_BACK_URL');

      if (!mpAccessToken || mpAccessToken === 'your_mercadopago_access_token_here') {
        return new Response(
          JSON.stringify({
            success: false,
            error: "MercadoPago not configured"
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const plan = subscription.plan;

      // Calculate trial period
      const now = new Date();
      const trialEnd = subscription.trial_end ? new Date(subscription.trial_end) : null;
      let trialFrequency = 0;
      let trialFrequencyType = 'days';

      if (trialEnd && trialEnd > now) {
        const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysRemaining > 0) {
          if (daysRemaining >= 30) {
            trialFrequency = Math.floor(daysRemaining / 30);
            trialFrequencyType = 'months';
          } else {
            trialFrequency = daysRemaining;
            trialFrequencyType = 'days';
          }
        }
      }

      // Build MercadoPago preapproval payload
      const mpPayload: any = {
        reason: `Suscripción ${plan.name} - ${application.name}`,
        payer_email: payer_email,
        auto_recurring: {
          frequency: plan.billing_cycle === 'annual' ? 12 : 1,
          frequency_type: 'months',
          transaction_amount: plan.price,
          currency_id: plan.currency || 'UYU',
        },
        back_url: mpBackUrl || `${supabaseUrl}/subscription-success`,
        status: 'pending',
      };

      // Add trial period if applicable
      if (trialFrequency > 0) {
        mpPayload.auto_recurring.free_trial = {
          frequency: trialFrequency,
          frequency_type: trialFrequencyType,
        };
      }

      // Add external reference to link back to our subscription
      mpPayload.external_reference = subscription.id;

      console.log('Creating MercadoPago preapproval:', mpPayload);

      // Create preapproval in MercadoPago
      const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mpAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mpPayload),
      });

      if (!mpResponse.ok) {
        const errorText = await mpResponse.text();
        console.error('MercadoPago API error:', errorText);
        return new Response(
          JSON.stringify({
            success: false,
            error: `MercadoPago API error: ${mpResponse.status}`,
            details: errorText
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const mpData = await mpResponse.json();
      console.log('MercadoPago preapproval created:', mpData);

      // Update subscription with MercadoPago data
      await supabase
        .from("subscriptions")
        .update({
          provider_subscription_id: mpData.id,
          payment_provider: 'mercadopago',
          metadata: {
            ...subscription.metadata,
            mp_preapproval_id: mpData.id,
            mp_init_point: mpData.init_point,
            mp_status: mpData.status,
            payer_email: payer_email,
          }
        })
        .eq("id", subscription.id);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            subscription_id: subscription.id,
            preapproval_id: mpData.id,
            checkout_url: mpData.init_point,
            status: mpData.status,
            message: "Please complete the payment registration to activate recurring payments"
          }
        }),
        {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // GET /subscription-status - Check if user has payment method registered
    if (path === '/subscription-status' && req.method === 'GET') {
      const external_user_id = url.searchParams.get('external_user_id');
      const external_app_id = url.searchParams.get('external_app_id');

      if (!external_user_id || !external_app_id) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Missing required parameters: external_user_id, external_app_id"
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Find the application
      const { data: application } = await supabase
        .from("applications")
        .select("id")
        .eq("external_app_id", external_app_id)
        .maybeSingle();

      if (!application) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Application not found"
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Find the user
      const { data: appUser } = await supabase
        .from("application_users")
        .select("tenant_id")
        .eq("external_user_id", external_user_id)
        .eq("application_id", application.id)
        .maybeSingle();

      if (!appUser) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "User not found"
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Find the subscription
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("*, plan:plans(*)")
        .eq("tenant_id", appUser.tenant_id)
        .eq("application_id", application.id)
        .order("created_at", { ascending: false })
        .maybeSingle();

      if (!subscription) {
        return new Response(
          JSON.stringify({
            success: false,
            has_payment_method: false,
            error: "No subscription found"
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const now = new Date();
      const trialEnd = subscription.trial_end ? new Date(subscription.trial_end) : null;
      const daysUntilTrialEnd = trialEnd ? Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;

      return new Response(
        JSON.stringify({
          success: true,
          has_payment_method: !!subscription.provider_subscription_id,
          subscription: {
            id: subscription.id,
            status: subscription.status,
            plan_name: subscription.plan.name,
            trial_end: subscription.trial_end,
            days_until_trial_end: daysUntilTrialEnd > 0 ? daysUntilTrialEnd : 0,
            payment_provider: subscription.payment_provider,
          }
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Route not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
