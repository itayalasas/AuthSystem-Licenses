import { useState, useEffect } from 'react';
import { X, Users, Mail, Calendar, Clock, ExternalLink, CreditCard, AlertCircle, CheckCircle, XCircle, RefreshCw, Plus, UserPlus } from 'lucide-react';
import { Button } from './Button';
import { AdminAPIService, ApplicationUser, License, Plan } from '../lib/admin-api';
import { ConfirmModal } from './ConfirmModal';
import { useToast } from '../hooks/useToast';

interface ApplicationUsersModalProps {
  applicationId: string;
  applicationName: string;
  adminApi: AdminAPIService;
  onClose: () => void;
}

export function ApplicationUsersModal({
  applicationId,
  applicationName,
  adminApi,
  onClose,
}: ApplicationUsersModalProps) {
  const [users, setUsers] = useState<ApplicationUser[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ApplicationUser | null>(null);
  const [assigningPlan, setAssigningPlan] = useState<string | null>(null);
  const [creatingTenant, setCreatingTenant] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    loadUsers();
    loadPlans();
  }, [applicationId]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getApplicationUsers(applicationId);
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const data = await adminApi.getPlans(applicationId);
      setPlans(data.filter(p => p.is_active !== false));
    } catch (error) {
      console.error('Failed to load plans:', error);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (date: string | null | undefined) => {
    if (!date) return 'Nunca';
    return new Date(date).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleRenewLicense = async (user: ApplicationUser) => {
    if (!user.tenant?.id || !user.subscription?.id) {
      showToast('No se puede renovar: el usuario no tiene tenant o suscripción activa', 'error');
      return;
    }

    try {
      showToast('Funcionalidad de renovación en desarrollo. Se renovará la licencia por 30 días más.', 'info');
    } catch (error) {
      console.error('Error al renovar licencia:', error);
      showToast('Error al renovar la licencia', 'error');
    }
  };

  const handleCancelSubscriptionClick = (user: ApplicationUser) => {
    if (!user.subscription?.id) {
      showToast('No hay suscripción para cancelar', 'error');
      return;
    }
    setSelectedUser(user);
    setShowConfirmCancel(true);
  };

  const handleConfirmCancel = async () => {
    setShowConfirmCancel(false);
    try {
      showToast('Funcionalidad de cancelación en desarrollo. Se cancelará la suscripción al final del período actual.', 'info');
    } catch (error) {
      console.error('Error al cancelar suscripción:', error);
      showToast('Error al cancelar la suscripción', 'error');
    } finally {
      setSelectedUser(null);
    }
  };

  const handleAssignPlan = async (user: ApplicationUser, planId: string) => {
    if (!user.tenant?.id) {
      showToast('El usuario no tiene un tenant asociado. No se puede asignar un plan.', 'error');
      return;
    }

    try {
      setAssigningPlan(user.id);
      await adminApi.assignPlanToUser(user.external_user_id, planId, applicationId);
      showToast('Plan asignado exitosamente', 'success');
      await loadUsers();
    } catch (error) {
      console.error('Error al asignar plan:', error);
      showToast('Error al asignar el plan', 'error');
    } finally {
      setAssigningPlan(null);
    }
  };

  const handleCreateTenant = async (user: ApplicationUser) => {
    try {
      setCreatingTenant(user.id);
      await adminApi.createTenant({
        name: user.name,
        owner_user_id: user.external_user_id,
        owner_email: user.email,
        billing_email: user.email,
        organization_name: `${user.name} Org`,
      });
      showToast('Tenant creado exitosamente', 'success');
      await loadUsers();
    } catch (error) {
      console.error('Error al crear tenant:', error);
      showToast('Error al crear el tenant', 'error');
    } finally {
      setCreatingTenant(null);
    }
  };

  return (
    <>
      <ConfirmModal
        isOpen={showConfirmCancel}
        title="Cancelar Suscripción"
        message={`¿Estás seguro de cancelar la suscripción de ${selectedUser?.name}? La suscripción permanecerá activa hasta el final del período actual.`}
        confirmText="Cancelar Suscripción"
        cancelText="Volver"
        variant="warning"
        onConfirm={handleConfirmCancel}
        onCancel={() => {
          setShowConfirmCancel(false);
          setSelectedUser(null);
        }}
      />

      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-scale-in flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Usuarios de {applicationName}</h2>
              <p className="text-sm text-gray-600 mt-0.5">
                {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No hay usuarios registrados en esta aplicación</p>
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 space-y-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">{user.name}</h3>
                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                          <Mail size={14} />
                          <span>{user.email}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Clock size={14} className="text-gray-400" />
                          <span>
                            <span className="font-medium">Último acceso:</span>{' '}
                            {formatDateTime(user.last_login)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar size={14} className="text-gray-400" />
                          <span>
                            <span className="font-medium">Registrado:</span>{' '}
                            {formatDate(user.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">ID externo:</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700">
                          {user.external_user_id}
                        </code>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 text-xs font-medium rounded-full flex-shrink-0 ${
                        user.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : user.status === 'suspended'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {user.status === 'active' ? 'Activo' : user.status === 'suspended' ? 'Suspendido' : 'Inactivo'}
                    </span>
                  </div>

                  {/* License & Subscription Info */}
                  {user.subscription || user.license ? (
                    <div className="border-t border-gray-200 pt-4 space-y-3">
                      {/* Subscription Info */}
                      {user.subscription && (
                        <div className="bg-blue-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <CreditCard size={16} className="text-blue-600" />
                              <span className="font-semibold text-sm text-gray-900">Suscripción</span>
                            </div>
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                user.subscription.status === 'active'
                                  ? 'bg-green-100 text-green-700'
                                  : user.subscription.status === 'trialing'
                                  ? 'bg-blue-100 text-blue-700'
                                  : user.subscription.status === 'past_due'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {user.subscription.status === 'active'
                                ? 'Activa'
                                : user.subscription.status === 'trialing'
                                ? 'En prueba'
                                : user.subscription.status === 'past_due'
                                ? 'Vencida'
                                : user.subscription.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-gray-600">Plan:</span>
                              <span className="ml-1 font-medium text-gray-900">
                                {user.subscription.plan_name || 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">Precio:</span>
                              <span className="ml-1 font-medium text-gray-900">
                                {user.subscription.plan_price ? `$${user.subscription.plan_price} ${user.subscription.plan_currency}` : 'N/A'}
                              </span>
                            </div>
                            {user.subscription.trial_end && (
                              <div className="col-span-2">
                                <span className="text-gray-600">Trial termina:</span>
                                <span className="ml-1 font-medium text-gray-900">
                                  {formatDate(user.subscription.trial_end)}
                                </span>
                              </div>
                            )}
                            <div className="col-span-2">
                              <span className="text-gray-600">Período:</span>
                              <span className="ml-1 font-medium text-gray-900">
                                {formatDate(user.subscription.period_start)} - {formatDate(user.subscription.period_end)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* License Info */}
                      {user.license && (
                        <div className="bg-green-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <CheckCircle size={16} className="text-green-600" />
                              <span className="font-semibold text-sm text-gray-900">Licencia</span>
                            </div>
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                user.license.status === 'active'
                                  ? 'bg-green-100 text-green-700'
                                  : user.license.status === 'expired'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {user.license.status === 'active'
                                ? 'Activa'
                                : user.license.status === 'expired'
                                ? 'Expirada'
                                : user.license.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-gray-600">Tipo:</span>
                              <span className="ml-1 font-medium text-gray-900 capitalize">
                                {user.license.type}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">Expira:</span>
                              <span className="ml-1 font-medium text-gray-900">
                                {formatDateTime(user.license.expires_at)}
                              </span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-gray-600">Token JTI:</span>
                              <code className="ml-1 text-xs bg-white px-1.5 py-0.5 rounded font-mono text-gray-700">
                                {user.license.jti.substring(0, 16)}...
                              </code>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2">
                        <button
                          className="flex-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                          onClick={() => handleRenewLicense(user)}
                        >
                          <RefreshCw size={14} />
                          Renovar Licencia
                        </button>
                        <button
                          className="flex-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                          onClick={() => handleCancelSubscriptionClick(user)}
                        >
                          <XCircle size={14} />
                          Cancelar Suscripción
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-gray-200 pt-4">
                      <div className="bg-yellow-50 rounded-lg p-3 flex items-start gap-2 mb-3">
                        <AlertCircle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-yellow-900">Sin licencia activa</p>
                          <p className="text-xs text-yellow-700 mt-0.5">
                            Este usuario no tiene una suscripción o licencia asignada.
                          </p>
                        </div>
                      </div>

                      {plans.length > 0 && user.tenant && (
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Asignar plan de suscripción:
                          </label>
                          <div className="grid grid-cols-1 gap-2">
                            {plans.map((plan) => (
                              <button
                                key={plan.id}
                                onClick={() => handleAssignPlan(user, plan.id)}
                                disabled={assigningPlan === user.id}
                                className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                              >
                                <div className="flex-1 text-left">
                                  <p className="text-sm font-medium text-gray-900 group-hover:text-blue-900">
                                    {plan.name}
                                  </p>
                                  <p className="text-xs text-gray-600 mt-0.5">
                                    {plan.currency} {Number(plan.price).toFixed(2)} /{' '}
                                    {plan.billing_cycle === 'monthly' ? 'mes' : 'año'}
                                    {plan.trial_days && plan.trial_days > 0 && (
                                      <span className="ml-2 text-blue-600">
                                        • {plan.trial_days} días de prueba
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <Plus
                                  size={18}
                                  className="text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0"
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {plans.length === 0 && user.tenant && (
                        <p className="text-xs text-gray-500 text-center py-2">
                          No hay planes disponibles para asignar. Crea un plan primero.
                        </p>
                      )}

                      {!user.tenant && (
                        <div className="space-y-2">
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <p className="text-xs text-gray-600 mb-3">
                              Este usuario no tiene un tenant asociado. Crea uno para poder asignarle un plan.
                            </p>
                            <button
                              onClick={() => handleCreateTenant(user)}
                              disabled={creatingTenant === user.id}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                            >
                              {creatingTenant === user.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                  Creando tenant...
                                </>
                              ) : (
                                <>
                                  <UserPlus size={16} />
                                  Crear Tenant
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Los usuarios se sincronizan automáticamente desde la aplicación externa
            </p>
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
