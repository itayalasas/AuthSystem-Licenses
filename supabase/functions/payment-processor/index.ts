import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SubscriptionStatus {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: string;
  trial_start: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  plan: {
    name: string;
    price: number;
    currency: string;
    billing_cycle: string;
    trial_days: number;
  };
  tenant: {
    name: string;
    owner_email: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const path = url.pathname.replace('/payment-processor', '');

    // GET /subscription/:subscription_id/status - Check subscription and trial status
    if (path.match(/^\/subscription\/[^/]+\/status$/) && req.method === 'GET') {
      const subscriptionId = path.split('/')[2];

      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          plan:plans(*),
          tenant:tenants(name, owner_email, billing_email)
        `)
        .eq('id', subscriptionId)
        .single();

      if (error || !subscription) {
        return new Response(
          JSON.stringify({ success: false, error: 'Subscription not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const now = new Date();
      const trialEnd = subscription.trial_end ? new Date(subscription.trial_end) : null;
      const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;

      const isInTrial = subscription.status === 'trialing' && trialEnd && now < trialEnd;
      const trialDaysRemaining = trialEnd ? Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      const needsPayment = subscription.status === 'past_due' || (subscription.status === 'trialing' && trialEnd && now >= trialEnd);
      const daysUntilExpiry = periodEnd ? Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;

      // Get payment history
      const { data: payments } = await supabase
        .from('subscription_payments')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .order('created_at', { ascending: false })
        .limit(5);

      const lastPayment = payments && payments.length > 0 ? payments[0] : null;

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            subscription_id: subscription.id,
            status: subscription.status,
            is_in_trial: isInTrial,
            trial_days_remaining: trialDaysRemaining,
            trial_end_date: subscription.trial_end,
            needs_payment: needsPayment,
            days_until_expiry: daysUntilExpiry,
            current_period_end: subscription.current_period_end,
            plan: subscription.plan,
            tenant: subscription.tenant,
            last_payment: lastPayment,
            recent_payments: payments || [],
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // POST /process-expiring-trials - Process trials that are expiring soon (cron job)
    if (path === '/process-expiring-trials' && req.method === 'POST') {
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      // Find trials expiring in 3 days
      const { data: expiringTrials, error: fetchError } = await supabase
        .from('subscriptions')
        .select(`
          *,
          plan:plans(*),
          tenant:tenants(name, owner_email, billing_email)
        `)
        .eq('status', 'trialing')
        .gte('trial_end', now.toISOString())
        .lte('trial_end', threeDaysFromNow.toISOString());

      if (fetchError) throw fetchError;

      const notifications = [];

      for (const subscription of expiringTrials || []) {
        const trialEnd = new Date(subscription.trial_end);
        const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Check if we already have a payment for this subscription
        const { data: existingPayment } = await supabase
          .from('subscription_payments')
          .select('id')
          .eq('subscription_id', subscription.id)
          .eq('status', 'completed')
          .maybeSingle();

        if (!existingPayment) {
          notifications.push({
            subscription_id: subscription.id,
            tenant_name: subscription.tenant.name,
            email: subscription.tenant.billing_email || subscription.tenant.owner_email,
            plan: subscription.plan.name,
            days_remaining: daysRemaining,
            amount: subscription.plan.price,
            currency: subscription.plan.currency,
            trial_end: subscription.trial_end,
          });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Processed ${expiringTrials?.length || 0} expiring trials`,
          notifications_to_send: notifications.length,
          notifications,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // POST /initiate-payment - Initiate payment for subscription
    if (path === '/initiate-payment' && req.method === 'POST') {
      const { subscription_id, payment_provider, return_url } = await req.json();

      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select(`
          *,
          plan:plans(*),
          tenant:tenants(*)
        `)
        .eq('id', subscription_id)
        .single();

      if (subError || !subscription) {
        return new Response(
          JSON.stringify({ success: false, error: 'Subscription not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Calculate period dates
      const now = new Date();
      let periodEnd: Date;

      if (subscription.plan.billing_cycle === 'monthly') {
        periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      } else if (subscription.plan.billing_cycle === 'annual') {
        periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      } else {
        periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      // Create pending payment record
      const { data: payment, error: paymentError } = await supabase
        .from('subscription_payments')
        .insert({
          subscription_id: subscription.id,
          tenant_id: subscription.tenant_id,
          plan_id: subscription.plan_id,
          amount: subscription.plan.price,
          currency: subscription.plan.currency,
          status: 'pending',
          payment_provider: payment_provider || 'manual',
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
          metadata: {
            initiated_at: now.toISOString(),
            return_url: return_url,
            from_trial: subscription.status === 'trialing',
          },
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Here you would integrate with actual payment providers
      // For now, we return the payment details for manual processing
      const paymentUrl = `${return_url || '/'}?payment_id=${payment.id}&amount=${subscription.plan.price}&currency=${subscription.plan.currency}`;

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            payment_id: payment.id,
            amount: subscription.plan.price,
            currency: subscription.plan.currency,
            payment_url: paymentUrl,
            subscription: {
              id: subscription.id,
              plan: subscription.plan.name,
              status: subscription.status,
            },
          },
        }),
        {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // POST /auto-process-payments - Automatically process due payments (cron job)
    if (path === '/auto-process-payments' && req.method === 'POST') {
      const now = new Date();

      // Find subscriptions that need payment
      const { data: dueSubscriptions, error: fetchError } = await supabase
        .from('subscriptions')
        .select(`
          *,
          plan:plans(*),
          tenant:tenants(*)
        `)
        .in('status', ['past_due', 'trialing'])
        .lte('current_period_end', now.toISOString());

      if (fetchError) throw fetchError;

      const processed = [];
      const failed = [];

      for (const subscription of dueSubscriptions || []) {
        // Check if there's a recent payment attempt
        const { data: recentPayment } = await supabase
          .from('subscription_payments')
          .select('*')
          .eq('subscription_id', subscription.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Don't create duplicate pending payments
        if (recentPayment && recentPayment.status === 'pending') {
          continue;
        }

        try {
          // Calculate new period
          let periodEnd: Date;
          if (subscription.plan.billing_cycle === 'monthly') {
            periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          } else {
            periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
          }

          // Create payment record
          const { data: payment, error: paymentError } = await supabase
            .from('subscription_payments')
            .insert({
              subscription_id: subscription.id,
              tenant_id: subscription.tenant_id,
              plan_id: subscription.plan_id,
              amount: subscription.plan.price,
              currency: subscription.plan.currency,
              status: 'pending',
              payment_provider: subscription.payment_provider || 'manual',
              provider_customer_id: subscription.provider_customer_id,
              period_start: now.toISOString(),
              period_end: periodEnd.toISOString(),
              metadata: {
                auto_generated: true,
                generated_at: now.toISOString(),
              },
            })
            .select()
            .single();

          if (paymentError) throw paymentError;

          processed.push({
            subscription_id: subscription.id,
            payment_id: payment.id,
            tenant: subscription.tenant.name,
            amount: subscription.plan.price,
          });
        } catch (error) {
          failed.push({
            subscription_id: subscription.id,
            tenant: subscription.tenant.name,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Processed ${processed.length} subscriptions, ${failed.length} failed`,
          processed,
          failed,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // GET /pending-payments - Get all pending payments
    if (path === '/pending-payments' && req.method === 'GET') {
      const { data: payments, error } = await supabase
        .from('subscription_payments')
        .select(`
          *,
          subscription:subscriptions(
            *,
            plan:plans(*),
            tenant:tenants(*)
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          count: payments?.length || 0,
          data: payments || [],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Route not found' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
