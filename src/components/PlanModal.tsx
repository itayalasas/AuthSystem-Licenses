import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Plan, Application } from '../lib/admin-api';

interface PlanModalProps {
  plan: Plan | null;
  applications: Application[];
  onClose: () => void;
  onCreate: (data: any) => void;
  onUpdate?: (data: any) => void;
}

export function PlanModal({ plan, applications, onClose, onCreate, onUpdate }: PlanModalProps) {
  const isEditing = plan !== null;
  const [loading, setLoading] = useState(false);
  const [entitlements, setEntitlements] = useState<Record<string, any>>(
    plan?.entitlements || {
      max_users: 0,
      max_storage_gb: 0,
      features: {},
    }
  );

  const [formData, setFormData] = useState({
    application_id: plan?.application_id || '',
    name: plan?.name || '',
    description: plan?.description || '',
    price: plan?.price || 0,
    currency: plan?.currency || 'USD',
    billing_cycle: plan?.billing_cycle || 'monthly',
    trial_days: plan?.trial_days || 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        ...formData,
        entitlements,
      };

      if (isEditing && onUpdate) {
        onUpdate(data);
      } else {
        onCreate(data);
      }
      onClose();
    } catch (error) {
      console.error('Error saving plan:', error);
      alert('Error al guardar el plan');
    } finally {
      setLoading(false);
    }
  };

  const addFeature = () => {
    const featureName = prompt('Nombre de la funcionalidad:');
    if (featureName) {
      setEntitlements({
        ...entitlements,
        features: {
          ...entitlements.features,
          [featureName]: true,
        },
      });
    }
  };

  const removeFeature = (featureKey: string) => {
    const newFeatures = { ...entitlements.features };
    delete newFeatures[featureKey];
    setEntitlements({
      ...entitlements,
      features: newFeatures,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {plan ? 'Editar Plan' : 'Crear Nuevo Plan'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Aplicación
              </label>
              <select
                value={formData.application_id}
                onChange={(e) => setFormData({ ...formData, application_id: e.target.value })}
                required
                disabled={!!plan}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">Seleccionar aplicación...</option>
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Plan
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Plan Profesional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Días de Prueba
                </label>
                <input
                  type="number"
                  value={formData.trial_days}
                  onChange={(e) =>
                    setFormData({ ...formData, trial_days: parseInt(e.target.value) || 0 })
                  }
                  min="0"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="14"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Perfecto para pequeñas empresas..."
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Precio</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
                  }
                  min="0"
                  step="0.01"
                  required
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="49.99"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Moneda</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="UYU">UYU</option>
                  <option value="ARS">ARS</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ciclo de Facturación
                </label>
                <select
                  value={formData.billing_cycle}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      billing_cycle: e.target.value as 'monthly' | 'annual',
                    })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="monthly">Mensual</option>
                  <option value="annual">Anual</option>
                </select>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Límites y Recursos</h3>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Máximo de Usuarios
                  </label>
                  <input
                    type="number"
                    value={entitlements.max_users}
                    onChange={(e) =>
                      setEntitlements({
                        ...entitlements,
                        max_users: parseInt(e.target.value) || 0,
                      })
                    }
                    min="0"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Almacenamiento (GB)
                  </label>
                  <input
                    type="number"
                    value={entitlements.max_storage_gb}
                    onChange={(e) =>
                      setEntitlements({
                        ...entitlements,
                        max_storage_gb: parseInt(e.target.value) || 0,
                      })
                    }
                    min="0"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="100"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Funcionalidades</h3>
                <button
                  type="button"
                  onClick={addFeature}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
                >
                  Agregar Funcionalidad
                </button>
              </div>

              <div className="space-y-2">
                {Object.keys(entitlements.features || {}).length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No hay funcionalidades configuradas
                  </p>
                ) : (
                  Object.entries(entitlements.features || {}).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={value as boolean}
                          onChange={(e) =>
                            setEntitlements({
                              ...entitlements,
                              features: {
                                ...entitlements.features,
                                [key]: e.target.checked,
                              },
                            })
                          }
                          className="w-5 h-5 text-blue-600"
                        />
                        <span className="text-sm font-medium text-gray-900">{key}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFeature(key)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Guardando...' : plan ? 'Actualizar Plan' : 'Crear Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
