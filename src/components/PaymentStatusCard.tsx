import { AlertCircle, CheckCircle, Clock, CreditCard, XCircle } from 'lucide-react';

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_provider: string;
  paid_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  created_at: string;
}

interface PaymentStatusCardProps {
  subscriptionStatus: {
    subscription_id: string;
    status: string;
    is_in_trial: boolean;
    trial_days_remaining: number;
    trial_end_date: string | null;
    needs_payment: boolean;
    days_until_expiry: number;
    current_period_end: string | null;
    plan: {
      name: string;
      price: number;
      currency: string;
      billing_cycle: string;
    };
    last_payment: Payment | null;
    recent_payments: Payment[];
  };
  onInitiatePayment?: () => void;
}

export function PaymentStatusCard({ subscriptionStatus, onInitiatePayment }: PaymentStatusCardProps) {
  const {
    status,
    is_in_trial,
    trial_days_remaining,
    trial_end_date,
    needs_payment,
    days_until_expiry,
    plan,
    last_payment,
    recent_payments,
  } = subscriptionStatus;

  const getStatusColor = () => {
    if (is_in_trial) return 'bg-blue-50 border-blue-200';
    if (status === 'active') return 'bg-green-50 border-green-200';
    if (status === 'past_due') return 'bg-red-50 border-red-200';
    if (status === 'expired') return 'bg-gray-50 border-gray-200';
    return 'bg-yellow-50 border-yellow-200';
  };

  const getStatusIcon = () => {
    if (is_in_trial) return <Clock className="w-5 h-5 text-blue-600" />;
    if (status === 'active') return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (status === 'past_due') return <AlertCircle className="w-5 h-5 text-red-600" />;
    if (status === 'expired') return <XCircle className="w-5 h-5 text-gray-600" />;
    return <Clock className="w-5 h-5 text-yellow-600" />;
  };

  const getStatusText = () => {
    if (is_in_trial) return `Trial - ${trial_days_remaining} days remaining`;
    if (status === 'active') return `Active - ${days_until_expiry} days until renewal`;
    if (status === 'past_due') return 'Payment Required';
    if (status === 'expired') return 'Expired';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const getPaymentStatusBadge = (payment: Payment) => {
    const statusColors: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      processing: 'bg-blue-100 text-blue-800',
      refunded: 'bg-gray-100 text-gray-800',
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          statusColors[payment.status] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
      <div className={`p-6 border-b-2 ${getStatusColor()}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{plan.name} Plan</h3>
              <p className="text-sm text-gray-600">{getStatusText()}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {formatAmount(plan.price, plan.currency)}
            </div>
            <div className="text-sm text-gray-600">
              per {plan.billing_cycle === 'annual' ? 'year' : 'month'}
            </div>
          </div>
        </div>

        {is_in_trial && (
          <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 mt-4">
            <p className="text-sm text-blue-900">
              <strong>Trial Period:</strong> Your trial ends on {formatDate(trial_end_date)}.
              {needs_payment && (
                <span className="block mt-1">
                  Payment will be required to continue using the service after the trial.
                </span>
              )}
            </p>
          </div>
        )}

        {needs_payment && (
          <div className="bg-red-100 border border-red-300 rounded-lg p-3 mt-4">
            <p className="text-sm text-red-900 mb-2">
              <strong>Action Required:</strong> Your subscription requires payment.
            </p>
            {onInitiatePayment && (
              <button
                onClick={onInitiatePayment}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                <CreditCard className="w-4 h-4" />
                Make Payment
              </button>
            )}
          </div>
        )}
      </div>

      <div className="p-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-4">Recent Payments</h4>

        {recent_payments && recent_payments.length > 0 ? (
          <div className="space-y-3">
            {recent_payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getPaymentStatusBadge(payment)}
                    <span className="text-xs text-gray-500">
                      {formatDate(payment.paid_at || payment.created_at)}
                    </span>
                  </div>
                  {payment.payment_provider && (
                    <p className="text-xs text-gray-600">
                      via {payment.payment_provider}
                    </p>
                  )}
                  {payment.failure_reason && (
                    <p className="text-xs text-red-600 mt-1">
                      {payment.failure_reason}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">
                    {formatAmount(payment.amount, payment.currency)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No payment history yet</p>
          </div>
        )}
      </div>

      {last_payment && last_payment.status === 'completed' && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Last Payment:</span>
            <span className="font-medium text-gray-900">
              {formatDate(last_payment.paid_at)} - {formatAmount(last_payment.amount, last_payment.currency)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
