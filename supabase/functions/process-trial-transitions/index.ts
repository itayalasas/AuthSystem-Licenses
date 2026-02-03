import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    console.log('🔄 Starting trial transition processing...');

    const now = new Date();

    // Find all trialing subscriptions where trial_end has passed or is today
    const { data: expiringTrials, error: fetchError } = await supabase
      .from('subscriptions')
      .select(`
        *,
        plan:plans(*),
        tenant:tenants(*)
      `)
      .eq('status', 'trialing')
      .lte('trial_end', now.toISOString());

    if (fetchError) {
      console.error('Error fetching expiring trials:', fetchError);
      throw fetchError;
    }

    console.log(`📊 Found ${expiringTrials?.length || 0} expiring trials`);

    const results = {
      processed: [] as any[],
      skipped: [] as any[],
      failed: [] as any[],
    };

    for (const subscription of expiringTrials || []) {
      try {
        console.log(`\n🔍 Processing subscription ${subscription.id} for tenant ${subscription.tenant.name}`);

        // Check if subscription has payment method registered
        if (subscription.provider_subscription_id) {
          console.log(`✅ Subscription has payment method (${subscription.payment_provider}): ${subscription.provider_subscription_id}`);

          // MercadoPago will charge automatically, we just need to:
          // 1. Update subscription status to active
          // 2. Extend period_end based on billing cycle

          const periodStart = now;
          let periodEnd: Date;

          if (subscription.plan.billing_cycle === 'annual') {
            periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
          } else {
            periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          }

          // Update subscription to active
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              status: 'active',
              period_start: periodStart.toISOString(),
              period_end: periodEnd.toISOString(),
              metadata: {
                ...subscription.metadata,
                trial_converted_at: now.toISOString(),
                auto_renewed: true,
              }
            })
            .eq('id', subscription.id);

          if (updateError) {
            console.error('Error updating subscription:', updateError);
            throw updateError;
          }

          // Update license
          const { data: license, error: licenseError } = await supabase
            .from('licenses')
            .select('*')
            .eq('subscription_id', subscription.id)
            .eq('tenant_id', subscription.tenant_id)
            .maybeSingle();

          if (license) {
            await supabase
              .from('licenses')
              .update({
                type: 'paid',
                status: 'active',
                expires_at: periodEnd.toISOString(),
                metadata: {
                  ...license.metadata,
                  converted_from_trial: true,
                  converted_at: now.toISOString(),
                }
              })
              .eq('id', license.id);

            console.log('✅ License updated to paid status');
          }

          results.processed.push({
            subscription_id: subscription.id,
            tenant: subscription.tenant.name,
            plan: subscription.plan.name,
            action: 'converted_to_paid',
            period_end: periodEnd.toISOString(),
          });

          console.log(`✅ Subscription converted to paid, will be charged by ${subscription.payment_provider}`);
        } else {
          console.log(`⚠️ No payment method registered, marking as past_due`);

          // No payment method registered - mark as past_due
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              status: 'past_due',
              metadata: {
                ...subscription.metadata,
                trial_ended_at: now.toISOString(),
                requires_payment_method: true,
              }
            })
            .eq('id', subscription.id);

          if (updateError) {
            console.error('Error updating subscription:', updateError);
            throw updateError;
          }

          // Update license to expired
          const { data: license } = await supabase
            .from('licenses')
            .select('*')
            .eq('subscription_id', subscription.id)
            .eq('tenant_id', subscription.tenant_id)
            .maybeSingle();

          if (license) {
            await supabase
              .from('licenses')
              .update({
                status: 'expired',
                metadata: {
                  ...license.metadata,
                  trial_expired: true,
                  expired_at: now.toISOString(),
                }
              })
              .eq('id', license.id);

            console.log('✅ License marked as expired');
          }

          results.processed.push({
            subscription_id: subscription.id,
            tenant: subscription.tenant.name,
            plan: subscription.plan.name,
            action: 'marked_past_due',
            reason: 'no_payment_method',
          });

          console.log(`✅ Subscription marked as past_due - requires payment method`);
        }
      } catch (error) {
        console.error(`❌ Error processing subscription ${subscription.id}:`, error);
        results.failed.push({
          subscription_id: subscription.id,
          tenant: subscription.tenant?.name || 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log('\n📈 Processing complete:');
    console.log(`   ✅ Processed: ${results.processed.length}`);
    console.log(`   ⏭️  Skipped: ${results.skipped.length}`);
    console.log(`   ❌ Failed: ${results.failed.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.processed.length} trial transitions`,
        stats: {
          total: expiringTrials?.length || 0,
          processed: results.processed.length,
          skipped: results.skipped.length,
          failed: results.failed.length,
        },
        details: results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error('❌ Fatal error:', error);
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
