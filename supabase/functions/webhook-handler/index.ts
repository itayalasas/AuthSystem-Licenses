import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface WebhookPayload {
  provider: 'mercadopago' | 'dlocal' | 'stripe';
  event_type: string;
  event_id: string;
  data: any;
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
    const path = url.pathname.replace('/webhook-handler', '');

    // POST /mercadopago - Handle Mercado Pago webhooks
    if (path === '/mercadopago' && req.method === 'POST') {
      const payload = await req.json();
      
      // Log webhook event
      const { error: logError } = await supabase
        .from('webhook_events')
        .insert({
          provider: 'mercadopago',
          event_id: payload.id || crypto.randomUUID(),
          event_type: payload.type || payload.action,
          payload: payload,
          processed: false,
        });

      if (logError) console.error('Failed to log webhook:', logError);

      // Process different event types
      try {
        await processMercadoPagoEvent(supabase, payload);
        
        // Mark as processed
        await supabase
          .from('webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('event_id', payload.id);

      } catch (error) {
        // Log error
        await supabase
          .from('webhook_events')
          .update({ 
            error: error instanceof Error ? error.message : 'Unknown error',
            processed_at: new Date().toISOString() 
          })
          .eq('event_id', payload.id);
        
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Webhook processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /stripe - Handle Stripe webhooks
    if (path === '/stripe' && req.method === 'POST') {
      const payload = await req.json();
      
      // Log webhook event
      const { error: logError } = await supabase
        .from('webhook_events')
        .insert({
          provider: 'stripe',
          event_id: payload.id || crypto.randomUUID(),
          event_type: payload.type,
          payload: payload,
          processed: false,
        });

      if (logError) console.error('Failed to log webhook:', logError);

      try {
        await processStripeEvent(supabase, payload);
        
        // Mark as processed
        await supabase
          .from('webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('event_id', payload.id);

      } catch (error) {
        // Log error
        await supabase
          .from('webhook_events')
          .update({ 
            error: error instanceof Error ? error.message : 'Unknown error',
            processed_at: new Date().toISOString() 
          })
          .eq('event_id', payload.id);
        
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Webhook processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /dlocal - Handle dLocal webhooks
    if (path === '/dlocal' && req.method === 'POST') {
      const payload = await req.json();
      
      // Log webhook event
      const { error: logError } = await supabase
        .from('webhook_events')
        .insert({
          provider: 'dlocal',
          event_id: payload.id || crypto.randomUUID(),
          event_type: payload.type || payload.event,
          payload: payload,
          processed: false,
        });

      if (logError) console.error('Failed to log webhook:', logError);

      try {
        await processDLocalEvent(supabase, payload);
        
        // Mark as processed
        await supabase
          .from('webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('event_id', payload.id);

      } catch (error) {
        // Log error
        await supabase
          .from('webhook_events')
          .update({ 
            error: error instanceof Error ? error.message : 'Unknown error',
            processed_at: new Date().toISOString() 
          })
          .eq('event_id', payload.id);
        
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Webhook processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
    console.error('Error processing webhook:', error);
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

// Process Mercado Pago webhook events
async function processMercadoPagoEvent(supabase: any, payload: any) {
  const eventType = payload.type || payload.action;
  
  // Handle subscription events
  if (eventType === 'payment.created' || eventType === 'payment.approved') {
    // Payment approved - activate subscription
    const preapprovalId = payload.data?.preapproval_id;
    
    if (preapprovalId) {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*, plan:plans(*)')
        .eq('provider_subscription_id', preapprovalId)
        .maybeSingle();

      if (subscription) {
        const now = new Date();
        const periodEnd = new Date(
          now.getTime() +
            (subscription.plan.billing_cycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000
        );

        await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            period_start: now.toISOString(),
            period_end: periodEnd.toISOString(),
          })
          .eq('id', subscription.id);

        // Create invoice record
        await supabase
          .from('invoices')
          .insert({
            tenant_id: subscription.tenant_id,
            subscription_id: subscription.id,
            amount: subscription.plan.price,
            currency: subscription.plan.currency,
            status: 'paid',
            payment_provider: 'mercadopago',
            provider_invoice_id: payload.data?.id,
            issued_at: now.toISOString(),
            paid_at: now.toISOString(),
          });
      }
    }
  }
  
  if (eventType === 'payment.failed' || eventType === 'payment.rejected') {
    // Payment failed - mark as past_due
    const preapprovalId = payload.data?.preapproval_id;
    
    if (preapprovalId) {
      await supabase
        .from('subscriptions')
        .update({ status: 'past_due' })
        .eq('provider_subscription_id', preapprovalId);
    }
  }
  
  if (eventType === 'preapproval.cancelled' || eventType === 'preapproval.paused') {
    // Subscription canceled or paused
    const preapprovalId = payload.data?.id;
    
    if (preapprovalId) {
      const newStatus = eventType.includes('cancelled') ? 'canceled' : 'paused';
      await supabase
        .from('subscriptions')
        .update({ 
          status: newStatus,
          canceled_at: new Date().toISOString()
        })
        .eq('provider_subscription_id', preapprovalId);
    }
  }
}

// Process Stripe webhook events
async function processStripeEvent(supabase: any, payload: any) {
  const eventType = payload.type;
  
  if (eventType === 'invoice.paid') {
    const invoice = payload.data.object;
    const subscriptionId = invoice.subscription;
    
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*, plan:plans(*)')
      .eq('provider_subscription_id', subscriptionId)
      .maybeSingle();

    if (subscription) {
      const periodEnd = new Date(invoice.lines.data[0].period.end * 1000);
      
      await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          period_end: periodEnd.toISOString(),
        })
        .eq('id', subscription.id);

      // Create invoice record
      await supabase
        .from('invoices')
        .insert({
          tenant_id: subscription.tenant_id,
          subscription_id: subscription.id,
          amount: invoice.amount_paid / 100,
          currency: invoice.currency.toUpperCase(),
          status: 'paid',
          payment_provider: 'stripe',
          provider_invoice_id: invoice.id,
          issued_at: new Date(invoice.created * 1000).toISOString(),
          paid_at: new Date(invoice.status_transitions.paid_at * 1000).toISOString(),
        });
    }
  }
  
  if (eventType === 'invoice.payment_failed') {
    const invoice = payload.data.object;
    const subscriptionId = invoice.subscription;
    
    await supabase
      .from('subscriptions')
      .update({ status: 'past_due' })
      .eq('provider_subscription_id', subscriptionId);
  }
  
  if (eventType === 'customer.subscription.deleted') {
    const subscription = payload.data.object;
    
    await supabase
      .from('subscriptions')
      .update({ 
        status: 'canceled',
        canceled_at: new Date().toISOString()
      })
      .eq('provider_subscription_id', subscription.id);
  }
}

// Process dLocal webhook events
async function processDLocalEvent(supabase: any, payload: any) {
  const eventType = payload.type || payload.event;
  
  if (eventType === 'payment.success' || eventType === 'payment.approved') {
    const subscriptionId = payload.subscription_id;
    
    if (subscriptionId) {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*, plan:plans(*)')
        .eq('provider_subscription_id', subscriptionId)
        .maybeSingle();

      if (subscription) {
        const now = new Date();
        const periodEnd = new Date(
          now.getTime() +
            (subscription.plan.billing_cycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000
        );

        await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            period_start: now.toISOString(),
            period_end: periodEnd.toISOString(),
          })
          .eq('id', subscription.id);

        // Create invoice record
        await supabase
          .from('invoices')
          .insert({
            tenant_id: subscription.tenant_id,
            subscription_id: subscription.id,
            amount: payload.amount,
            currency: payload.currency,
            status: 'paid',
            payment_provider: 'dlocal',
            provider_invoice_id: payload.id,
            issued_at: now.toISOString(),
            paid_at: now.toISOString(),
          });
      }
    }
  }
  
  if (eventType === 'payment.failed' || eventType === 'payment.rejected') {
    const subscriptionId = payload.subscription_id;
    
    if (subscriptionId) {
      await supabase
        .from('subscriptions')
        .update({ status: 'past_due' })
        .eq('provider_subscription_id', subscriptionId);
    }
  }
  
  if (eventType === 'subscription.cancelled') {
    const subscriptionId = payload.subscription_id;
    
    if (subscriptionId) {
      await supabase
        .from('subscriptions')
        .update({ 
          status: 'canceled',
          canceled_at: new Date().toISOString()
        })
        .eq('provider_subscription_id', subscriptionId);
    }
  }
}