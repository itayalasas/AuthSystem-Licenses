import { useState, useEffect } from 'react';
import { X, Trash2, Edit2 } from 'lucide-react';
import type { Plan, Application } from '../lib/admin-api';
import { FeatureModal } from './FeatureModal';
import { useToast } from '../hooks/useToast';

interface PlanModalProps {
  plan: Plan | null;
  applications: Application[];
  onClose: () => void;
  onCreate: (data: any) => void;
  onUpdate?: (data: any) => void;
  adminApi: any;
}

export function PlanModal({ plan, applications, onClose, onCreate, onUpdate, adminApi }: PlanModalProps) {
  const isEditing = plan !== null;
  const [loading, setLoading] = useState(false);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [editingFeature, setEditingFeature] = useState<{ code: string; value: string } | undefined>();
  const { success, error: showError } = useToast();
  const [features, setFeatures] = useState<Record<string, string>>(
    plan?.entitlements?.features || {}
  );

  const [formData, setFormData] = useState({
    application_id: plan?.application_id || '',
    name: plan?.name || '',
    description: plan?.description || '',
    price: plan?.price || 0,
    currency: plan?.currency || 'USD',
    billing_cycle: plan?.billing_cycle || 'monthly',
    trial_days: plan?.trial_days || 14,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        ...formData,
        entitlements: {
          features,
        },
      };

      if (isEditing && onUpdate) {
        onUpdate(data);
      } else {
        onCreate(data);
      }
      onClose();
    } catch (err) {
      console.error('Error saving plan:', err);
      showError('Error al guardar el plan');
    } finally {
      setLoading(false);
    }
  };

  const addFeature = () => {
    setEditingFeature(undefined);
    setShowFeatureModal(true);
  };

  const editFeature = (code: string, value: string) => {
    setEditingFeature({ code, value });
    setShowFeatureModal(true);
  };

  const handleSaveFeature = (code: string, value: string) => {
    setFeatures({
      ...features,
      [code]: value,
    });
    setShowFeatureModal(false);
    setEditingFeature(undefined);
    success(`Funcionalidad "${code}" ${editingFeature ? 'actualizada' : 'agregada'}`);
  };

  const removeFeature = (featureKey: string) => {
    const newFeatures = { ...features };
    delete newFeatures[featureKey];
    setFeatures(newFeatures);
    success(`Funcionalidad "${featureKey}" eliminada`);
  };

  return (
    <>
      <FeatureModal
        isOpen={showFeatureModal}
        onConfirm={handleSaveFeature}
        onCancel={() => {
          setShowFeatureModal(false);
          setEditingFeature(undefined);
        }}
        existingFeature={editingFeature}
        adminApi={adminApi}
      />

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
                {Object.keys(features).length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No hay funcionalidades configuradas
                  </p>
                ) : (
                  Object.entries(features).map(([key, value]) => {
                    const displayValue = value === '0' || value === 'false' ?
                      (value === '0' ? 'Ilimitado' : 'Deshabilitado') :
                      (value === 'true' ? 'Habilitado' : value);

                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-gray-900">{key}</span>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                              {displayValue}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => editFeature(key, value)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFeature(key)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
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
    </>
  );
}
