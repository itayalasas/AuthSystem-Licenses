import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface PaymentPayload {
  subscription_id: string;
  amount: number;
  currency?: string;
  payment_method?: string;
  payment_provider: 'mercadopago' | 'dlocal' | 'stripe' | 'manual';
  provider_transaction_id?: string;
  provider_customer_id?: string;
  metadata?: Record<string, any>;
}

interface RefundPayload {
  payment_id: string;
  amount?: number;
  reason?: string;
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
    const path = url.pathname.replace('/payment-manager', '');

    // POST /payments/by-user - Create payment using external_app_id and user_id
    if (path === '/payments/by-user' && req.method === 'POST') {
      const { external_app_id, user_id, user_email, payment_provider, payment_method, metadata } = await req.json();

      if (!external_app_id || (!user_id && !user_email)) {
        return new Response(
          JSON.stringify({ success: false, error: 'external_app_id and (user_id or user_email) are required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { data: application } = await supabase
        .from('applications')
        .select('id')
        .eq('external_app_id', external_app_id)
        .maybeSingle();

      if (!application) {
        return new Response(
          JSON.stringify({ success: false, error: 'Application not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      let tenantQuery = supabase.from('tenants').select('id');
      if (user_id) {
        tenantQuery = tenantQuery.eq('owner_user_id', user_id);
      } else {
        tenantQuery = tenantQuery.eq('owner_email', user_email);
      }

      const { data: tenant } = await tenantQuery.maybeSingle();

      if (!tenant) {
        return new Response(
          JSON.stringify({ success: false, error: 'Tenant not found for this user' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('*, plan:plans(*), tenant:tenants(*)')
        .eq('tenant_id', tenant.id)
        .eq('application_id', application.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError || !subscription) {
        return new Response(
          JSON.stringify({ success: false, error: 'Subscription not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const now = new Date();
      let periodEnd: Date;

      if (subscription.plan.billing_cycle === 'monthly') {
        periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      } else if (subscription.plan.billing_cycle === 'annual') {
        periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      } else {
        periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      const { data: payment, error: paymentError } = await supabase
        .from('subscription_payments')
        .insert({
          subscription_id: subscription.id,
          tenant_id: subscription.tenant_id,
          plan_id: subscription.plan_id,
          amount: subscription.plan.price,
          currency: subscription.plan.currency || 'USD',
          status: 'pending',
          payment_method: payment_method,
          payment_provider: payment_provider || 'manual',
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
          metadata: metadata || {},
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      return new Response(
        JSON.stringify({
          success: true,
          data: payment,
          subscription: {
            id: subscription.id,
            plan: subscription.plan.name,
            amount: subscription.plan.price,
            currency: subscription.plan.currency
          }
        }),
        {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // POST /payments - Create a new payment
    if (path === '/payments' && req.method === 'POST') {
      const payload: PaymentPayload = await req.json();

      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('*, plan:plans(*), tenant:tenants(*)')
        .eq('id', payload.subscription_id)
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

      const now = new Date();
      let periodEnd: Date;

      if (subscription.plan.billing_cycle === 'monthly') {
        periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      } else if (subscription.plan.billing_cycle === 'annual') {
        periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      } else {
        periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      const { data: payment, error: paymentError } = await supabase
        .from('subscription_payments')
        .insert({
          subscription_id: payload.subscription_id,
          tenant_id: subscription.tenant_id,
          plan_id: subscription.plan_id,
          amount: payload.amount,
          currency: payload.currency || 'USD',
          status: 'pending',
          payment_method: payload.payment_method,
          payment_provider: payload.payment_provider,
          provider_transaction_id: payload.provider_transaction_id,
          provider_customer_id: payload.provider_customer_id,
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
          metadata: payload.metadata || {},
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      return new Response(
        JSON.stringify({ success: true, data: payment }),
        {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // PUT /payments/:id/complete - Mark payment as completed
    if (path.match(/^\/payments\/[^/]+\/complete$/) && req.method === 'PUT') {
      const paymentId = path.split('/')[2];
      const { provider_transaction_id, paid_at, metadata } = await req.json();

      const now = new Date();

      const { data: payment, error: updateError } = await supabase
        .from('subscription_payments')
        .update({
          status: 'completed',
          paid_at: paid_at || now.toISOString(),
          provider_transaction_id: provider_transaction_id,
          metadata: metadata || {},
        })
        .eq('id', paymentId)
        .select()
        .single();

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: payment,
          message: 'Payment completed successfully. Subscription will be activated automatically.' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // PUT /payments/:id/fail - Mark payment as failed
    if (path.match(/^\/payments\/[^/]+\/fail$/) && req.method === 'PUT') {
      const paymentId = path.split('/')[2];
      const { failure_reason, metadata } = await req.json();

      const now = new Date();

      const { data: payment, error: updateError } = await supabase
        .from('subscription_payments')
        .update({
          status: 'failed',
          failed_at: now.toISOString(),
          failure_reason: failure_reason || 'Payment failed',
          metadata: metadata || {},
        })
        .eq('id', paymentId)
        .select()
        .single();

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ success: true, data: payment }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // POST /payments/:id/refund - Process a refund
    if (path.match(/^\/payments\/[^/]+\/refund$/) && req.method === 'POST') {
      const paymentId = path.split('/')[2];
      const payload: RefundPayload = await req.json();

      const { data: existingPayment, error: fetchError } = await supabase
        .from('subscription_payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (fetchError || !existingPayment) {
        return new Response(
          JSON.stringify({ success: false, error: 'Payment not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (existingPayment.status !== 'completed') {
        return new Response(
          JSON.stringify({ success: false, error: 'Can only refund completed payments' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const refundAmount = payload.amount || existingPayment.amount;
      const isPartialRefund = refundAmount < existingPayment.amount;

      const now = new Date();

      const { data: payment, error: updateError } = await supabase
        .from('subscription_payments')
        .update({
          status: isPartialRefund ? 'partially_refunded' : 'refunded',
          refunded_at: now.toISOString(),
          refund_amount: refundAmount,
          metadata: {
            ...existingPayment.metadata,
            refund_reason: payload.reason,
            refund_processed_at: now.toISOString(),
          },
        })
        .eq('id', paymentId)
        .select()
        .single();

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ success: true, data: payment }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // GET /payments/subscription/:subscription_id - Get all payments for a subscription
    if (path.match(/^\/payments\/subscription\/[^/]+$/) && req.method === 'GET') {
      const subscriptionId = path.split('/')[3];

      const { data: payments, error } = await supabase
        .from('subscription_payments')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: payments }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // GET /payments/tenant/:tenant_id - Get all payments for a tenant
    if (path.match(/^\/payments\/tenant\/[^/]+$/) && req.method === 'GET') {
      const tenantId = path.split('/')[3];

      const { data: payments, error } = await supabase
        .from('subscription_payments')
        .select('*, subscription:subscriptions(*, plan:plans(*))')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: payments }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // POST /check-trials - Check and update trial expirations (cron job)
    if (path === '/check-trials' && req.method === 'POST') {
      const { error } = await supabase.rpc('check_trial_expiration');

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: 'Trial expiration check completed' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // POST /check-renewals - Check and update subscription renewals (cron job)
    if (path === '/check-renewals' && req.method === 'POST') {
      const { error } = await supabase.rpc('check_subscription_renewal');

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: 'Subscription renewal check completed' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // GET /status-history/:subscription_id - Get status change history
    if (path.match(/^\/status-history\/[^/]+$/) && req.method === 'GET') {
      const subscriptionId = path.split('/')[2];

      const { data: history, error } = await supabase
        .from('subscription_status_history')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: history }),
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
