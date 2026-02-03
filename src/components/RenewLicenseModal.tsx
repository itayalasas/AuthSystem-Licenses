import { useState } from 'react';
import { X, RefreshCw, CreditCard, Calendar, DollarSign } from 'lucide-react';
import { Button } from './Button';
import { Plan, ApplicationUser } from '../lib/admin-api';

interface RenewLicenseModalProps {
  isOpen: boolean;
  user: ApplicationUser;
  plans: Plan[];
  onRenew: (planId: string) => Promise<void>;
  onClose: () => void;
}

export function RenewLicenseModal({
  isOpen,
  user,
  plans,
  onRenew,
  onClose,
}: RenewLicenseModalProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !user) return null;

  const handleRenew = async () => {
    if (!selectedPlanId) {
      console.log('No plan selected');
      return;
    }

    console.log('Starting renewal with plan:', selectedPlanId);
    setLoading(true);
    try {
      await onRenew(selectedPlanId);
      console.log('Renewal successful');
    } catch (error) {
      console.error('Error in handleRenew:', error);
      setLoading(false);
      throw error;
    }
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const currentPlanId = user.subscription?.plan?.id;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-scale-in flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Renovar o Cambiar Licencia</h2>
              <p className="text-sm text-gray-600 mt-0.5">{user.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={loading}
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Información Actual</h3>
            <div className="space-y-2 text-sm">
              {user.subscription && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Plan actual:</span>
                    <span className="font-medium text-gray-900">
                      {user.subscription.plan_name || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estado:</span>
                    <span className={`font-medium ${
                      user.subscription.status === 'active' ? 'text-green-600' :
                      user.subscription.status === 'trialing' ? 'text-blue-600' :
                      'text-yellow-600'
                    }`}>
                      {user.subscription.status === 'active' ? 'Activa' :
                       user.subscription.status === 'trialing' ? 'En prueba' :
                       user.subscription.status}
                    </span>
                  </div>
                </>
              )}
              {user.license && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tipo de licencia:</span>
                    <span className="font-medium text-gray-900 capitalize">{user.license.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Expira:</span>
                    <span className="font-medium text-gray-900">
                      {new Date(user.license.expires_at).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Selecciona un nuevo plan:
            </label>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {plans.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No hay planes disponibles para esta aplicación
                </p>
              ) : (
                plans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`w-full text-left p-4 border-2 rounded-lg transition-all ${
                      selectedPlanId === plan.id
                        ? 'border-blue-500 bg-blue-50'
                        : currentPlanId === plan.id
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900">{plan.name}</h4>
                          {currentPlanId === plan.id && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                              Plan Actual
                            </span>
                          )}
                        </div>
                        {plan.description && (
                          <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                        )}
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${
                        selectedPlanId === plan.id
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300'
                      }`}>
                        {selectedPlanId === plan.id && (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-3">
                      <div className="flex items-center gap-1">
                        <DollarSign size={14} />
                        <span className="font-medium text-gray-900">
                          {plan.currency} {Number(plan.price).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        <span>{plan.billing_cycle === 'monthly' ? 'Mensual' : 'Anual'}</span>
                      </div>
                      {plan.trial_days && plan.trial_days > 0 && (
                        <div className="flex items-center gap-1 text-blue-600">
                          <CreditCard size={14} />
                          <span>{plan.trial_days} días de prueba</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {selectedPlan && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>Nota:</strong> {currentPlanId === selectedPlan.id
                  ? 'Renovarás el plan actual con las mismas características.'
                  : 'Cambiarás al nuevo plan seleccionado. Los cambios serán inmediatos.'}
              </p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50 flex gap-3 justify-end flex-shrink-0">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleRenew}
            disabled={!selectedPlanId || loading}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                Procesando...
              </>
            ) : (
              <>
                <RefreshCw size={16} className="mr-2" />
                {currentPlanId === selectedPlanId ? 'Renovar Licencia' : 'Cambiar Plan'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
