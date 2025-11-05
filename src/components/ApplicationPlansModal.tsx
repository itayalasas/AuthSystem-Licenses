import { useState, useEffect, useRef } from 'react';
import { X, Plus, Edit2, Trash2, DollarSign, Link } from 'lucide-react';
import { Application, Plan } from '../lib/admin-api';
import { Button } from './Button';

interface ApplicationPlansModalProps {
  application: Application;
  plans: Plan[];
  allPlans: Plan[];
  onClose: () => void;
  onAddPlan: () => void;
  onEditPlan: (plan: Plan) => void;
  onDeletePlan: (planId: string) => void;
  onAssignExistingPlan: (planId: string) => void;
}

export function ApplicationPlansModal({ application, plans, allPlans, onClose, onAddPlan, onEditPlan, onDeletePlan, onAssignExistingPlan }: ApplicationPlansModalProps) {
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const availablePlans = allPlans.filter(p =>
    p.application_id !== application.id &&
    !plans.some(ap => ap.id === p.id)
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowAssignMenu(false);
      }
    };

    if (showAssignMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAssignMenu]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Planes de {application.name}</h2>
            <p className="text-sm text-gray-600 mt-1">Gestiona los planes de suscripción de esta aplicación</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-gray-600">
              {plans.length} {plans.length === 1 ? 'plan' : 'planes'} configurado{plans.length === 1 ? '' : 's'}
            </p>
            <div className="relative" ref={menuRef}>
              <Button
                onClick={() => setShowAssignMenu(!showAssignMenu)}
                icon={<Plus size={16} />}
                size="sm"
              >
                Agregar Plan
              </Button>

              {showAssignMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                  <button
                    onClick={() => {
                      setShowAssignMenu(false);
                      onAddPlan();
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 flex items-center gap-3"
                  >
                    <Plus size={16} className="text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">Crear Nuevo Plan</p>
                      <p className="text-xs text-gray-500">Crear un plan desde cero</p>
                    </div>
                  </button>

                  {availablePlans.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                        <p className="text-xs font-medium text-gray-700">Asignar Plan Existente</p>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {availablePlans.map((plan) => (
                          <button
                            key={plan.id}
                            onClick={() => {
                              setShowAssignMenu(false);
                              onAssignExistingPlan(plan.id);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900 text-sm">{plan.name}</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {plan.currency} {Number(plan.price).toFixed(2)} / {plan.billing_cycle === 'monthly' ? 'mes' : 'año'}
                                </p>
                              </div>
                              <Link size={14} className="text-gray-400 mt-1" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {plans.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                <DollarSign className="text-gray-400" size={32} />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay planes configurados
              </h3>
              <p className="text-gray-600 mb-6">
                Crea el primer plan para esta aplicación
              </p>
              <Button onClick={onAddPlan} icon={<Plus size={16} />}>
                Crear Plan
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            plan.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {plan.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      {plan.description && (
                        <p className="text-sm text-gray-600 mb-3">{plan.description}</p>
                      )}
                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-gray-500">Precio:</span>{' '}
                          <span className="font-semibold text-gray-900">
                            {plan.currency} {Number(plan.price).toFixed(2)}
                          </span>
                          <span className="text-gray-500">
                            {' '}/ {plan.billing_cycle === 'monthly' ? 'mes' : 'año'}
                          </span>
                        </div>
                        {plan.trial_days > 0 && (
                          <div>
                            <span className="text-gray-500">Prueba:</span>{' '}
                            <span className="font-semibold text-blue-600">
                              {plan.trial_days} días
                            </span>
                          </div>
                        )}
                      </div>
                      {plan.entitlements?.features && Object.keys(plan.entitlements.features).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs text-gray-500 mb-2">Funcionalidades:</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(plan.entitlements.features).map(([key, value]) => (
                              <span
                                key={key}
                                className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium"
                              >
                                {key}: {String(value)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditPlan(plan)}
                        icon={<Edit2 size={14} />}
                        className="text-blue-600 hover:bg-blue-50"
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`¿Eliminar el plan "${plan.name}"?`)) {
                            onDeletePlan(plan.id);
                          }
                        }}
                        icon={<Trash2 size={14} />}
                        className="text-red-600 hover:bg-red-50"
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200">
          <Button onClick={onClose} variant="secondary" className="w-full">
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
