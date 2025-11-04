import { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { Application, Plan } from '../lib/admin-api';

interface PlanSelectorProps {
  app: Application;
  plans: Plan[];
  onAssignPlan: (app: Application, planId: string) => Promise<void>;
}

export function PlanSelector({ app, plans, onAssignPlan }: PlanSelectorProps) {
  const [loading, setLoading] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const planId = e.target.value;
    if (!planId) return;

    setLoading(true);
    try {
      await onAssignPlan(app, planId);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <Loader2 size={14} className="animate-spin flex-shrink-0" />
        <span>Asignando plan...</span>
      </div>
    );
  }

  if (app.plan_id) {
    return (
      <div className="flex items-center gap-2">
        <select
          value={app.plan_id}
          onChange={handleChange}
          onClick={(e) => e.stopPropagation()}
          disabled={loading}
          className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        >
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <CreditCard size={14} className="text-gray-400 flex-shrink-0" />
      <select
        onChange={handleChange}
        onClick={(e) => e.stopPropagation()}
        disabled={loading}
        className="text-xs border border-gray-300 rounded px-2 py-1 text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        defaultValue=""
      >
        <option value="">Sin plan asignado</option>
        {plans.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.name}
          </option>
        ))}
      </select>
    </div>
  );
}
