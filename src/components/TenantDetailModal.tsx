import { useState, useEffect } from 'react';
import { X, Building2, Package, Plus, Trash2, Edit2, Check } from 'lucide-react';
import { AdminAPIService, type Tenant, type Plan, type Application } from '../lib/admin-api';
import { ConfirmModal } from './ConfirmModal';
import { useToast } from '../hooks/useToast';

interface TenantDetailModalProps {
  tenant: Tenant;
  onClose: () => void;
  onRefresh: () => void;
  adminApi: AdminAPIService;
  applications: Application[];
}

export function TenantDetailModal({ tenant, onClose, onRefresh, adminApi, applications }: TenantDetailModalProps) {
  const [detailedTenant, setDetailedTenant] = useState<Tenant | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGrantAccess, setShowGrantAccess] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [startTrial, setStartTrial] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showConfirmRevoke, setShowConfirmRevoke] = useState(false);
  const [appToRevoke, setAppToRevoke] = useState<string>('');
  const { showToast } = useToast();
  const [editedData, setEditedData] = useState({
    name: tenant.name,
    organization_name: tenant.organization_name || '',
    billing_email: tenant.billing_email || '',
    domain: tenant.domain || '',
  });

  useEffect(() => {
    loadTenantDetails();
  }, [tenant.id]);

  const loadTenantDetails = async () => {
    try {
      setLoading(true);
      const [tenantData, plansData] = await Promise.all([
        adminApi.getTenant(tenant.id),
        adminApi.getPlans(),
      ]);
      setDetailedTenant(tenantData);
      setPlans(plansData);
    } catch (error) {
      console.error('Failed to load tenant details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGrantAccess = async () => {
    if (!selectedAppId) {
      showToast('Selecciona una aplicación', 'error');
      return;
    }

    try {
      await adminApi.grantAccess(tenant.id, {
        application_id: selectedAppId,
        plan_id: selectedPlanId || undefined,
        start_trial: startTrial,
      });
      setShowGrantAccess(false);
      setSelectedAppId('');
      setSelectedPlanId('');
      setStartTrial(false);
      showToast('Acceso asignado exitosamente', 'success');
      loadTenantDetails();
      onRefresh();
    } catch (error) {
      console.error('Failed to grant access:', error);
      showToast('Error al asignar aplicación', 'error');
    }
  };

  const handleRevokeAccessClick = (appId: string) => {
    setAppToRevoke(appId);
    setShowConfirmRevoke(true);
  };

  const handleConfirmRevoke = async () => {
    setShowConfirmRevoke(false);
    try {
      await adminApi.revokeAccess(tenant.id, appToRevoke);
      showToast('Acceso revocado exitosamente', 'success');
      loadTenantDetails();
      onRefresh();
    } catch (error) {
      console.error('Failed to revoke access:', error);
      showToast('Error al revocar acceso', 'error');
    } finally {
      setAppToRevoke('');
    }
  };

  const handleSaveEdit = async () => {
    try {
      await adminApi.updateTenant(tenant.id, editedData);
      setEditing(false);
      showToast('Cliente actualizado exitosamente', 'success');
      loadTenantDetails();
      onRefresh();
    } catch (error) {
      console.error('Failed to update tenant:', error);
      showToast('Error al actualizar cliente', 'error');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  const availableApps = applications.filter(
    app => !detailedTenant?.tenant_applications?.some(ta => ta.application_id === app.id)
  );

  return (
    <>
      <ConfirmModal
        isOpen={showConfirmRevoke}
        title="Revocar Acceso"
        message="¿Estás seguro de revocar el acceso a esta aplicación? El tenant perderá acceso a todos los recursos asociados."
        confirmText="Revocar Acceso"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleConfirmRevoke}
        onCancel={() => {
          setShowConfirmRevoke(false);
          setAppToRevoke('');
        }}
      />

      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{detailedTenant?.name}</h2>
              <p className="text-sm text-gray-500">{detailedTenant?.owner_email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Información del Cliente</h3>
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  Editar
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                  >
                    <Check className="w-4 h-4" />
                    Guardar
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setEditedData({
                        name: tenant.name,
                        organization_name: tenant.organization_name || '',
                        billing_email: tenant.billing_email || '',
                        domain: tenant.domain || '',
                      });
                    }}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Nombre</label>
                {editing ? (
                  <input
                    type="text"
                    value={editedData.name}
                    onChange={e => setEditedData({ ...editedData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{detailedTenant?.name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Organización</label>
                {editing ? (
                  <input
                    type="text"
                    value={editedData.organization_name}
                    onChange={e => setEditedData({ ...editedData, organization_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{detailedTenant?.organization_name || '-'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Email de Facturación</label>
                {editing ? (
                  <input
                    type="email"
                    value={editedData.billing_email}
                    onChange={e => setEditedData({ ...editedData, billing_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{detailedTenant?.billing_email || '-'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Dominio</label>
                {editing ? (
                  <input
                    type="text"
                    value={editedData.domain}
                    onChange={e => setEditedData({ ...editedData, domain: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{detailedTenant?.domain || '-'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">ID del Propietario</label>
                <p className="text-gray-900 font-mono text-sm">{detailedTenant?.owner_user_id}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Estado</label>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                  detailedTenant?.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {detailedTenant?.status}
                </span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Aplicaciones Asignadas</h3>
              {availableApps.length > 0 && (
                <button
                  onClick={() => setShowGrantAccess(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Asignar Aplicación
                </button>
              )}
            </div>

            {detailedTenant?.tenant_applications && detailedTenant.tenant_applications.length > 0 ? (
              <div className="space-y-3">
                {detailedTenant.tenant_applications.map(ta => (
                  <div key={ta.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900">{ta.application?.name}</h4>
                          <p className="text-sm text-gray-500">{ta.application?.slug}</p>
                          {ta.subscription && (
                            <div className="mt-2 space-y-1">
                              <p className="text-xs text-gray-600">
                                Estado: <span className={`font-semibold ${
                                  ta.subscription.status === 'active' ? 'text-green-600' :
                                  ta.subscription.status === 'trialing' ? 'text-yellow-600' :
                                  'text-gray-600'
                                }`}>{ta.subscription.status}</span>
                              </p>
                              {ta.subscription.plan && (
                                <p className="text-xs text-gray-600">
                                  Plan: <span className="font-semibold">{ta.subscription.plan.name}</span>
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRevokeAccessClick(ta.application_id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No hay aplicaciones asignadas</p>
              </div>
            )}
          </div>

          {showGrantAccess && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-bold text-gray-900 mb-4">Asignar Nueva Aplicación</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Aplicación</label>
                  <select
                    value={selectedAppId}
                    onChange={e => setSelectedAppId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Selecciona una aplicación</option>
                    {availableApps.map(app => (
                      <option key={app.id} value={app.id}>{app.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Plan (opcional)</label>
                  <select
                    value={selectedPlanId}
                    onChange={e => setSelectedPlanId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    disabled={!selectedAppId}
                  >
                    <option value="">Sin plan específico</option>
                    {plans.filter(p => p.application_id === selectedAppId).map(plan => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} - ${plan.price}/{plan.billing_cycle}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="startTrial"
                    checked={startTrial}
                    onChange={e => setStartTrial(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="startTrial" className="text-sm text-gray-700">
                    Iniciar con periodo de prueba
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleGrantAccess}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                  >
                    Asignar
                  </button>
                  <button
                    onClick={() => {
                      setShowGrantAccess(false);
                      setSelectedAppId('');
                      setSelectedPlanId('');
                      setStartTrial(false);
                    }}
                    className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
