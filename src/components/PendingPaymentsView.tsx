import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface PendingPayment {
  id: string;
  subscription_id: string;
  tenant_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_provider: string;
  period_start: string;
  period_end: string;
  created_at: string;
  subscription: {
    tenant: {
      name: string;
      owner_email: string;
    };
    plan: {
      name: string;
    };
  };
}

export function PendingPaymentsView() {
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingPayments = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/payment-processor/pending-payments`,
        {
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch pending payments');

      const result = await response.json();
      setPayments(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingPayments();
  }, []);

  const handleCompletePayment = async (paymentId: string) => {
    setProcessing(paymentId);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/payment-manager/payments/${paymentId}/complete`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paid_at: new Date().toISOString(),
            provider_transaction_id: `manual_${Date.now()}`,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to complete payment');

      await fetchPendingPayments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete payment');
    } finally {
      setProcessing(null);
    }
  };

  const handleFailPayment = async (paymentId: string) => {
    setProcessing(paymentId);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/payment-manager/payments/${paymentId}/fail`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            failure_reason: 'Payment failed - manual marking',
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to mark payment as failed');

      await fetchPendingPayments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fail payment');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pending Payments</h2>
          <p className="text-sm text-gray-600 mt-1">
            {payments.length} payment{payments.length !== 1 ? 's' : ''} awaiting processing
          </p>
        </div>
        <Button onClick={fetchPendingPayments} disabled={loading}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {payments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-lg font-medium text-gray-900">No pending payments</p>
          <p className="text-sm text-gray-600 mt-1">All payments are up to date</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {payment.subscription.tenant.name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {payment.subscription.tenant.owner_email}
                    </p>
                    <p className="text-sm text-gray-600">
                      Plan: <span className="font-medium">{payment.subscription.plan.name}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      {formatAmount(payment.amount, payment.currency)}
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 mt-2">
                      Pending
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div>
                    <span className="text-gray-600">Created:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {formatDate(payment.created_at)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Provider:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {payment.payment_provider}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Period Start:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {formatDate(payment.period_start)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Period End:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {formatDate(payment.period_end)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <Button
                    onClick={() => handleCompletePayment(payment.id)}
                    disabled={processing === payment.id}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {processing === payment.id ? 'Processing...' : 'Mark as Paid'}
                  </Button>
                  <Button
                    onClick={() => handleFailPayment(payment.id)}
                    disabled={processing === payment.id}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {processing === payment.id ? 'Processing...' : 'Mark as Failed'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
