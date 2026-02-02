import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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
      
      try {
        await processMercadoPagoEvent(supabase, payload);
      } catch (error) {
        console.error('Error processing MercadoPago webhook:', error);
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
      
      try {
        await processStripeEvent(supabase, payload);
      } catch (error) {
        console.error('Error processing Stripe webhook:', error);
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
      
      try {
        await processDLocalEvent(supabase, payload);
      } catch (error) {
        console.error('Error processing dLocal webhook:', error);
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

async function updateOrCreateLicense(supabase: any, subscriptionId: string) {
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*, plan:plans(*), tenant:tenants(*)')
    .eq('id', subscriptionId)
    .maybeSingle();

  if (!subscription || !subscription.plan) {
    console.log('⚠️ Subscription or plan not found for license update');
    return;
  }

  const now = new Date();
  const expiresAt = new Date(subscription.period_end);
  const licenseType = subscription.status === 'trialing' ? 'trial' : 'paid';

  const { data: existingLicense } = await supabase
    .from('licenses')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .eq('tenant_id', subscription.tenant_id)
    .maybeSingle();

  if (existingLicense) {
    await supabase
      .from('licenses')
      .update({
        type: licenseType,
        status: 'active',
        expires_at: expiresAt.toISOString(),
        entitlements: subscription.plan.entitlements || {},
        metadata: {
          ...existingLicense.metadata,
          last_payment_processed: now.toISOString(),
          plan_name: subscription.plan.name,
        },
      })
      .eq('id', existingLicense.id);

    console.log('✅ License updated:', existingLicense.id);
  } else {
    const { data: newLicense } = await supabase
      .from('licenses')
      .insert({
        tenant_id: subscription.tenant_id,
        subscription_id: subscriptionId,
        application_id: subscription.plan.application_id,
        plan_id: subscription.plan_id,
        license_key: `LIC-${subscription.tenant_id.substring(0, 8)}-${Date.now()}`,
        type: licenseType,
        status: 'active',
        issued_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        entitlements: subscription.plan.entitlements || {},
        metadata: {
          created_by: 'webhook',
          plan_name: subscription.plan.name,
        },
      })
      .select()
      .maybeSingle();

    console.log('✅ New license created:', newLicense?.id);
  }
}

async function processMercadoPagoEvent(supabase: any, payload: any) {
  const eventType = payload.type || payload.action;

  console.log('📨 MercadoPago webhook received:', { eventType, payload });

  // Cuando se crea o aprueba una suscripción (preapproval)
  if (eventType === 'subscription_preapproval' || eventType === 'preapproval') {
    const preapprovalId = payload.data?.id;
    const status = payload.data?.status;
    const payerEmail = payload.data?.payer_email;
    const planId = payload.data?.preapproval_plan_id;

    console.log('📋 Preapproval event:', { preapprovalId, status, payerEmail, planId });

    if (preapprovalId && status === 'authorized') {
      // Buscar el plan por mp_preapproval_plan_id
      const { data: plan } = await supabase
        .from('plans')
        .select('*')
        .eq('mp_preapproval_plan_id', planId)
        .maybeSingle();

      if (plan) {
        // Buscar la suscripción del usuario por email
        const { data: applicationUser } = await supabase
          .from('application_users')
          .select('*, tenant:tenants(*)')
          .eq('external_user_id', payerEmail)
          .eq('application_id', plan.application_id)
          .maybeSingle();

        if (applicationUser) {
          // Buscar o crear suscripción
          const { data: subscription } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('tenant_id', applicationUser.tenant_id)
            .eq('plan_id', plan.id)
            .maybeSingle();

          if (subscription) {
            // Actualizar suscripción con el ID de MercadoPago
            await supabase
              .from('subscriptions')
              .update({
                provider_subscription_id: preapprovalId,
                status: 'active',
                metadata: {
                  ...subscription.metadata,
                  mp_preapproval_id: preapprovalId,
                  webhook_event: eventType,
                },
              })
              .eq('id', subscription.id);

            await updateOrCreateLicense(supabase, subscription.id);

            console.log('✅ Subscription updated with preapproval_id:', preapprovalId);
          }
        }
      }
    }
  }

  if (eventType === 'payment.created' || eventType === 'payment.approved') {
    const paymentId = payload.data?.id;
    const amount = payload.data?.transaction_amount;
    const customerId = payload.data?.payer?.id;
    const preapprovalId = payload.data?.preapproval_id;

    console.log('💰 Payment event:', { paymentId, amount, preapprovalId });

    if (paymentId) {
      // Primero buscar si existe un pago pendiente con este transaction_id
      const { data: pendingPayment } = await supabase
        .from('subscription_payments')
        .select('*, subscription:subscriptions(*)')
        .eq('provider_transaction_id', paymentId)
        .eq('status', 'pending')
        .maybeSingle();

      if (pendingPayment) {
        await supabase
          .from('subscription_payments')
          .update({
            status: 'completed',
            paid_at: new Date().toISOString(),
            provider_customer_id: customerId,
            metadata: {
              ...pendingPayment.metadata,
              webhook_event: eventType,
              processed_at: new Date().toISOString(),
            },
          })
          .eq('id', pendingPayment.id);

        await updateOrCreateLicense(supabase, pendingPayment.subscription_id);

        console.log('✅ Pending payment marked as completed:', paymentId);
      } else if (preapprovalId) {
        // Si no existe pago pendiente, pero hay un preapproval_id,
        // crear un nuevo pago para la suscripción
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('*, plan:plans(*), tenant:tenants(*)')
          .eq('provider_subscription_id', preapprovalId)
          .maybeSingle();

        if (subscription) {
          const now = new Date();
          let periodEnd: Date;

          if (subscription.plan.billing_cycle === 'monthly') {
            periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          } else {
            periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
          }

          await supabase
            .from('subscription_payments')
            .insert({
              subscription_id: subscription.id,
              tenant_id: subscription.tenant_id,
              plan_id: subscription.plan_id,
              amount: amount,
              currency: subscription.plan.currency || 'UYU',
              status: 'completed',
              payment_provider: 'mercadopago',
              provider_transaction_id: paymentId,
              provider_customer_id: customerId,
              period_start: now.toISOString(),
              period_end: periodEnd.toISOString(),
              paid_at: now.toISOString(),
              metadata: {
                webhook_event: eventType,
                preapproval_id: preapprovalId,
              },
            });

          await updateOrCreateLicense(supabase, subscription.id);

          console.log('✅ New payment created for subscription:', subscription.id);
        }
      }
    }
  }
  
  if (eventType === 'payment.failed' || eventType === 'payment.rejected') {
    const paymentId = payload.data?.id;
    const failureReason = payload.data?.status_detail || 'Payment failed';
    
    if (paymentId) {
      await supabase
        .from('subscription_payments')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          failure_reason: failureReason,
          metadata: {
            webhook_event: eventType,
            processed_at: new Date().toISOString(),
          },
        })
        .eq('provider_transaction_id', paymentId);
    }
  }
  
  if (eventType === 'preapproval.cancelled' || eventType === 'preapproval.paused') {
    const preapprovalId = payload.data?.id;
    
    if (preapprovalId) {
      const newStatus = eventType.includes('cancelled') ? 'canceled' : 'paused';
      await supabase
        .from('subscriptions')
        .update({ 
          status: newStatus,
          canceled_at: new Date().toISOString(),
          metadata: {
            cancellation_reason: 'User action via MercadoPago',
            webhook_event: eventType,
          },
        })
        .eq('provider_subscription_id', preapprovalId);
    }
  }
}

async function processStripeEvent(supabase: any, payload: any) {
  const eventType = payload.type;
  
  if (eventType === 'invoice.paid') {
    const invoice = payload.data.object;
    const stripeSubscriptionId = invoice.subscription;
    
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*, plan:plans(*)')
      .eq('provider_subscription_id', stripeSubscriptionId)
      .maybeSingle();

    if (subscription) {
      const periodEnd = new Date(invoice.lines.data[0].period.end * 1000);
      const periodStart = new Date(invoice.lines.data[0].period.start * 1000);
      
      const { data: payment } = await supabase
        .from('subscription_payments')
        .insert({
          subscription_id: subscription.id,
          tenant_id: subscription.tenant_id,
          plan_id: subscription.plan_id,
          amount: invoice.amount_paid / 100,
          currency: invoice.currency.toUpperCase(),
          status: 'completed',
          payment_method: invoice.payment_method_types?.[0] || 'card',
          payment_provider: 'stripe',
          provider_transaction_id: invoice.payment_intent,
          provider_customer_id: invoice.customer,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          paid_at: new Date(invoice.status_transitions.paid_at * 1000).toISOString(),
          metadata: {
            invoice_id: invoice.id,
            webhook_event: eventType,
          },
        })
        .select()
        .single();
    }
  }
  
  if (eventType === 'invoice.payment_failed') {
    const invoice = payload.data.object;
    const stripeSubscriptionId = invoice.subscription;
    
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('provider_subscription_id', stripeSubscriptionId)
      .maybeSingle();

    if (subscription) {
      await supabase
        .from('subscription_payments')
        .insert({
          subscription_id: subscription.id,
          tenant_id: subscription.tenant_id,
          plan_id: subscription.plan_id,
          amount: invoice.amount_due / 100,
          currency: invoice.currency.toUpperCase(),
          status: 'failed',
          payment_provider: 'stripe',
          provider_transaction_id: invoice.payment_intent,
          provider_customer_id: invoice.customer,
          period_start: new Date().toISOString(),
          period_end: new Date(invoice.lines.data[0].period.end * 1000).toISOString(),
          failed_at: new Date().toISOString(),
          failure_reason: invoice.last_finalization_error?.message || 'Payment failed',
          metadata: {
            invoice_id: invoice.id,
            webhook_event: eventType,
          },
        });
    }
  }
  
  if (eventType === 'customer.subscription.deleted') {
    const subscription = payload.data.object;
    
    await supabase
      .from('subscriptions')
      .update({ 
        status: 'canceled',
        canceled_at: new Date(subscription.canceled_at * 1000).toISOString(),
        metadata: {
          cancellation_reason: subscription.cancellation_details?.reason || 'User action',
          webhook_event: eventType,
        },
      })
      .eq('provider_subscription_id', subscription.id);
  }
}

async function processDLocalEvent(supabase: any, payload: any) {
  const eventType = payload.type || payload.event;
  
  if (eventType === 'payment.success' || eventType === 'payment.approved') {
    const transactionId = payload.id || payload.transaction_id;
    const subscriptionId = payload.subscription_id;
    
    if (transactionId && subscriptionId) {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*, plan:plans(*)')
        .eq('provider_subscription_id', subscriptionId)
        .maybeSingle();

      if (subscription) {
        const now = new Date();
        let periodEnd: Date;
        
        if (subscription.plan.billing_cycle === 'monthly') {
          periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        } else {
          periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
        }

        await supabase
          .from('subscription_payments')
          .insert({
            subscription_id: subscription.id,
            tenant_id: subscription.tenant_id,
            plan_id: subscription.plan_id,
            amount: payload.amount,
            currency: payload.currency || 'USD',
            status: 'completed',
            payment_method: payload.payment_method,
            payment_provider: 'dlocal',
            provider_transaction_id: transactionId,
            provider_customer_id: payload.payer?.id,
            period_start: now.toISOString(),
            period_end: periodEnd.toISOString(),
            paid_at: now.toISOString(),
            metadata: {
              webhook_event: eventType,
            },
          });
      }
    }
  }
  
  if (eventType === 'payment.failed' || eventType === 'payment.rejected') {
    const transactionId = payload.id || payload.transaction_id;
    const subscriptionId = payload.subscription_id;
    
    if (transactionId && subscriptionId) {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('provider_subscription_id', subscriptionId)
        .maybeSingle();

      if (subscription) {
        await supabase
          .from('subscription_payments')
          .insert({
            subscription_id: subscription.id,
            tenant_id: subscription.tenant_id,
            plan_id: subscription.plan_id,
            amount: payload.amount,
            currency: payload.currency || 'USD',
            status: 'failed',
            payment_provider: 'dlocal',
            provider_transaction_id: transactionId,
            period_start: new Date().toISOString(),
            period_end: new Date().toISOString(),
            failed_at: new Date().toISOString(),
            failure_reason: payload.status_detail || 'Payment failed',
            metadata: {
              webhook_event: eventType,
            },
          });
      }
    }
  }
  
  if (eventType === 'subscription.cancelled') {
    const subscriptionId = payload.subscription_id;
    
    if (subscriptionId) {
      await supabase
        .from('subscriptions')
        .update({ 
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          metadata: {
            cancellation_reason: 'User action via dLocal',
            webhook_event: eventType,
          },
        })
        .eq('provider_subscription_id', subscriptionId);
    }
  }
}