import { Plan } from '../lib/admin-api';
import { Edit2, Trash2, Check } from 'lucide-react';

interface PlanCardProps {
  plan: Plan;
  onEdit: (plan: Plan) => void;
  onDelete: (planId: string) => void;
}

export function PlanCard({ plan, onEdit, onDelete }: PlanCardProps) {
  const maxUsers = plan.entitlements?.max_users || 0;
  const features = plan.entitlements?.features || [];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-lg">{plan.name}</h3>
          <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(plan)}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Editar plan"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => {
              if (confirm(`¿Eliminar el plan "${plan.name}"?`)) {
                onDelete(plan.id);
              }
            }}
            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Eliminar plan"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="mb-4">
        <span className="text-3xl font-bold text-gray-900">
          {plan.price === 0 ? 'Gratis' : `$${plan.price}`}
        </span>
        <span className="text-gray-600 text-sm">
          /{plan.billing_cycle === 'monthly' ? 'mes' : 'año'}
        </span>
      </div>

      <div className="space-y-2 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Check size={16} className="text-green-600 flex-shrink-0" />
          <span>Hasta {maxUsers} usuarios</span>
        </div>
        {features.length > 0 && (
          <div className="space-y-1 mt-2">
            {features.slice(0, 3).map((feature: string, index: number) => (
              <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                <Check size={14} className="text-gray-400 flex-shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
            {features.length > 3 && (
              <p className="text-xs text-gray-500 ml-5">
                +{features.length - 3} características más
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
