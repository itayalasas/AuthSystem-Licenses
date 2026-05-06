import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

// Hardcoded until moved to secrets
const MP_ACCESS_TOKEN = 'APP_USR-6852491126052518-050319-afbaf6321b77ff2c148077e4d41fc53b-2519338363';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { mp_preapproval_id } = await req.json();

    if (!mp_preapproval_id?.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'mp_preapproval_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call MercadoPago API to cancel the subscription
    const mpResponse = await fetch(
      `https://api.mercadopago.com/preapproval/${mp_preapproval_id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({ status: 'cancelled' }),
      }
    );

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('MercadoPago error:', mpData);
      return new Response(
        JSON.stringify({
          success: false,
          error: mpData?.message || `MercadoPago returned status ${mpResponse.status}`,
          mp_error: mpData,
        }),
        { status: mpResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If MP confirmed cancellation, also update our DB immediately
    // (the webhook will do it too, but this ensures instant consistency)
    if (mpData.status === 'cancelled') {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('id, tenant_id')
        .eq('mp_preapproval_id', mp_preapproval_id)
        .maybeSingle();

      if (subscription) {
        await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
            metadata: {
              cancellation_reason: 'User cancelled via API',
              cancelled_at: new Date().toISOString(),
            },
          })
          .eq('id', subscription.id);

        await supabase
          .from('licenses')
          .update({
            status: 'revoked',
            metadata: {
              revoked_reason: 'Subscription cancelled by user',
              revoked_at: new Date().toISOString(),
            },
          })
          .eq('subscription_id', subscription.id)
          .eq('status', 'active');

        console.log('Subscription and licenses updated after cancellation:', subscription.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: mpData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
