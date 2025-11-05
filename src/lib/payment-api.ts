const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface InitiatePaymentData {
  subscription_id: string;
  payment_provider: 'mercadopago' | 'dlocal' | 'stripe' | 'manual';
  return_url?: string;
}

interface CompletePaymentData {
  provider_transaction_id?: string;
  paid_at?: string;
  metadata?: Record<string, any>;
}

interface FailPaymentData {
  failure_reason?: string;
  metadata?: Record<string, any>;
}

export async function getSubscriptionStatus(subscriptionId: string) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/payment-processor/subscription/${subscriptionId}/status`,
    {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function initiatePayment(data: InitiatePaymentData) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/payment-processor/initiate-payment`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function getPendingPayments() {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/payment-processor/pending-payments`,
    {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function completePayment(paymentId: string, data: CompletePaymentData = {}) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/payment-manager/payments/${paymentId}/complete`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function failPayment(paymentId: string, data: FailPaymentData = {}) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/payment-manager/payments/${paymentId}/fail`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function getSubscriptionPayments(subscriptionId: string) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/payment-manager/payments/subscription/${subscriptionId}`,
    {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function getTenantPayments(tenantId: string) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/payment-manager/payments/tenant/${tenantId}`,
    {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function getStatusHistory(subscriptionId: string) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/payment-manager/status-history/${subscriptionId}`,
    {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}
