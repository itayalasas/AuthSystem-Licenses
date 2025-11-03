import { useState, useEffect } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { subscriptionService, type Plan } from '../lib/subscription';

interface PlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlanId?: string;
  onSelectPlan: (plan: Plan) => void;
}

export function PlansModal({ isOpen, onClose, currentPlanId, onSelectPlan }: PlansModalProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    if (isOpen) {
      loadPlans();
    }
  }, [isOpen]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const data = await subscriptionService.getPlans();
      setPlans(data);
    } catch (error) {
      console.error('Failed to load plans:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredPlans = plans.filter(plan => plan.billing_cycle === billingCycle);
  const monthlyPlans = plans.filter(plan => plan.billing_cycle === 'monthly');
  const annualPlans = plans.filter(plan => plan.billing_cycle === 'annual');

  const savingsPercent = monthlyPlans.length > 0 && annualPlans.length > 0
    ? Math.round((1 - (annualPlans[0].price / (monthlyPlans[0].price * 12))) * 100)
    : 17;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Choose Your Plan</h2>
            <p className="text-gray-600 mt-1">Select the perfect plan for your needs</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`
                  px-6 py-2 rounded-md font-medium text-sm transition-all
                  ${billingCycle === 'monthly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`
                  px-6 py-2 rounded-md font-medium text-sm transition-all
                  ${billingCycle === 'annual'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                Annual
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  Save {savingsPercent}%
                </span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {filteredPlans.map((plan) => {
                const isCurrentPlan = plan.id === currentPlanId;
                const features = [
                  `Up to ${plan.entitlements.max_users} users`,
                  `${plan.entitlements.limits.storage_gb} GB storage`,
                  `${plan.entitlements.limits.monthly_emails.toLocaleString()} emails/month`,
                  plan.entitlements.features.advanced_reports ? 'Advanced reports' : null,
                  plan.entitlements.features.api_access ? 'API access' : null,
                  plan.entitlements.features.priority_support ? 'Priority support' : null,
                ].filter(Boolean);

                return (
                  <div
                    key={plan.id}
                    className={`
                      border rounded-xl p-6 hover:shadow-lg transition-all
                      ${isCurrentPlan ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'}
                    `}
                  >
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                      <p className="text-gray-600 text-sm mt-1">{plan.description}</p>
                    </div>

                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-gray-900">
                          ${plan.price}
                        </span>
                        <span className="text-gray-600">
                          {plan.currency}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        per {billingCycle === 'monthly' ? 'month' : 'year'}
                      </p>
                    </div>

                    <ul className="space-y-3 mb-6">
                      {features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                          <span className="text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => onSelectPlan(plan)}
                      disabled={isCurrentPlan}
                      className={`
                        w-full py-3 px-4 rounded-lg font-medium transition-all
                        ${isCurrentPlan
                          ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg'
                        }
                      `}
                    >
                      {isCurrentPlan ? 'Current Plan' : 'Select Plan'}
                    </button>

                    {plan.trial_days > 0 && !isCurrentPlan && (
                      <p className="text-center text-xs text-gray-500 mt-3">
                        {plan.trial_days}-day free trial
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
