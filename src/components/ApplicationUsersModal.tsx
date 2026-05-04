import { useState, useEffect } from 'react';
import { X, Users, Mail, Calendar, Clock, CreditCard, AlertCircle, CheckCircle, XCircle, RefreshCw, Plus, UserPlus, Building2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { AdminAPIService, ApplicationUser, TenantWithMembers, ApplicationUsersResult, License, Subscription, Plan } from '../lib/admin-api';
import { ConfirmModal } from './ConfirmModal';
import { RenewLicenseModal } from './RenewLicenseModal';
import { useToast } from '../hooks/useToast';

interface ApplicationUsersModalProps {
  applicationId: string;
  applicationName: string;
  adminApi: AdminAPIService;
  onClose: () => void;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(date: string | null | undefined) {
  if (!date) return 'Nunca';
  return new Date(date).toLocaleString('es-ES', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusBadge(status: string) {
  if (status === 'active') return 'bg-green-100 text-green-700';
  if (status === 'suspended') return 'bg-yellow-100 text-yellow-700';
  return 'bg-gray-100 text-gray-700';
}

function statusLabel(status: string) {
  if (status === 'active') return 'Activo';
  if (status === 'suspended') return 'Suspendido';
  return 'Inactivo';
}

function SubscriptionBlock({ subscription }: { subscription: Subscription }) {
  const plan = subscription.plan as any;
  return (
    <div className="bg-blue-50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CreditCard size={15} className="text-blue-600" />
          <span className="font-semibold text-sm text-gray-900">Suscripción</span>
        </div>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
          subscription.status === 'active' ? 'bg-green-100 text-green-700' :
          subscription.status === 'trialing' ? 'bg-blue-100 text-blue-700' :
          subscription.status === 'past_due' ? 'bg-yellow-100 text-yellow-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {subscription.status === 'active' ? 'Activa' :
           subscription.status === 'trialing' ? 'En prueba' :
           subscription.status === 'past_due' ? 'Vencida' :
           subscription.status}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500">Plan:</span>
          <span className="ml-1 font-medium text-gray-900">{plan?.name || subscription.plan_name || 'N/A'}</span>
        </div>
        <div>
          <span className="text-gray-500">Precio:</span>
          <span className="ml-1 font-medium text-gray-900">
            {plan?.price ? `$${plan.price} ${plan.currency}` : subscription.plan_price ? `$${subscription.plan_price} ${subscription.plan_currency}` : 'N/A'}
          </span>
        </div>
        {subscription.trial_end && (
          <div className="col-span-2">
            <span className="text-gray-500">Trial termina:</span>
            <span className="ml-1 font-medium text-gray-900">{formatDate(subscription.trial_end)}</span>
          </div>
        )}
        <div className="col-span-2">
          <span className="text-gray-500">Período:</span>
          <span className="ml-1 font-medium text-gray-900">
            {formatDate(subscription.period_start)} - {formatDate(subscription.period_end)}
          </span>
        </div>
      </div>
    </div>
  );
}

function LicenseBlock({ license }: { license: License }) {
  return (
    <div className="bg-green-50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CheckCircle size={15} className="text-green-600" />
          <span className="font-semibold text-sm text-gray-900">Licencia</span>
        </div>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
          license.status === 'active' ? 'bg-green-100 text-green-700' :
          license.status === 'expired' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {license.status === 'active' ? 'Activa' : license.status === 'expired' ? 'Expirada' : license.status}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500">Tipo:</span>
          <span className="ml-1 font-medium text-gray-900 capitalize">{license.type}</span>
        </div>
        <div>
          <span className="text-gray-500">Expira:</span>
          <span className="ml-1 font-medium text-gray-900">{formatDateTime(license.expires_at)}</span>
        </div>
        <div className="col-span-2">
          <span className="text-gray-500">Token JTI:</span>
          <code className="ml-1 text-xs bg-white px-1.5 py-0.5 rounded font-mono text-gray-700">
            {license.jti.substring(0, 16)}...
          </code>
        </div>
      </div>
    </div>
  );
}

// Tenant card with collapsible members list
function TenantCard({
  tenant,
  plans,
  assigningPlan,
  onRenew,
  onCancelSubscription,
  onAssignPlan,
}: {
  tenant: TenantWithMembers;
  plans: Plan[];
  assigningPlan: string | null;
  onRenew: (tenant: TenantWithMembers) => void;
  onCancelSubscription: (tenant: TenantWithMembers) => void;
  onAssignPlan: (tenant: TenantWithMembers, planId: string) => void;
}) {
  const [membersOpen, setMembersOpen] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-all">
      {/* Tenant header */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 size={18} className="text-slate-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{tenant.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">Creado {formatDate(tenant.created_at)}</p>
            </div>
          </div>
          <span className={`px-2.5 py-1 text-xs font-medium rounded-full flex-shrink-0 ${statusBadge(tenant.status)}`}>
            {statusLabel(tenant.status)}
          </span>
        </div>

        {/* Subscription & License */}
        {(tenant.subscription || tenant.license) ? (
          <div className="space-y-2 mb-3">
            {tenant.subscription && <SubscriptionBlock subscription={tenant.subscription} />}
            {tenant.license && <LicenseBlock license={tenant.license} />}

            <div className="flex gap-2 pt-1">
              <button
                className="flex-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                onClick={() => onRenew(tenant)}
              >
                <RefreshCw size={13} />
                Renovar Licencia
              </button>
              <button
                className="flex-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                onClick={() => onCancelSubscription(tenant)}
              >
                <XCircle size={13} />
                Cancelar Suscripción
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-3">
            <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 flex items-start gap-2 mb-2">
              <AlertCircle size={15} className="text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-900">Sin licencia activa</p>
                <p className="text-xs text-yellow-700 mt-0.5">Este tenant no tiene suscripción asignada.</p>
              </div>
            </div>

            {plans.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-gray-600">Asignar plan:</p>
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => onAssignPlan(tenant, plan.id)}
                    disabled={assigningPlan === tenant.id}
                    className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed group text-left"
                  >
                    <div>
                      <p className="text-xs font-medium text-gray-900 group-hover:text-blue-900">{plan.name}</p>
                      <p className="text-xs text-gray-500">
                        {plan.currency} {Number(plan.price).toFixed(2)} / {plan.billing_cycle === 'monthly' ? 'mes' : 'año'}
                        {plan.trial_days && plan.trial_days > 0 && <span className="ml-1.5 text-blue-600">• {plan.trial_days}d prueba</span>}
                      </p>
                    </div>
                    <Plus size={16} className="text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Members toggle */}
        <button
          onClick={() => setMembersOpen(!membersOpen)}
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-xs font-medium text-gray-700"
        >
          <div className="flex items-center gap-1.5">
            <Users size={13} className="text-gray-500" />
            <span>{tenant.members.length} miembro{tenant.members.length !== 1 ? 's' : ''} — licencia compartida</span>
          </div>
          {membersOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* Members list */}
      {membersOpen && tenant.members.length > 0 && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {tenant.members.map((member) => (
            <div key={member.external_user_id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-gray-50">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
                  <Mail size={11} />
                  <span className="truncate">{member.email}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {formatDateTime(member.last_login)}
                  </span>
                </div>
              </div>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${statusBadge(member.status)}`}>
                {statusLabel(member.status)}
              </span>
            </div>
          ))}
        </div>
      )}

      {membersOpen && tenant.members.length === 0 && (
        <div className="border-t border-gray-100 px-5 py-4 text-center text-xs text-gray-400">
          Sin miembros registrados
        </div>
      )}
    </div>
  );
}

export function ApplicationUsersModal({
  applicationId,
  applicationName,
  adminApi,
  onClose,
}: ApplicationUsersModalProps) {
  const [result, setResult] = useState<ApplicationUsersResult | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ApplicationUser | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<TenantWithMembers | null>(null);
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
      setResult(data);
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

  const handleRenewForUser = (user: ApplicationUser) => {
    if (!user.tenant?.id) { showToast('Sin tenant asociado', 'error'); return; }
    if (plans.length === 0) { showToast('No hay planes disponibles', 'error'); return; }
    setSelectedUser(user);
    setShowRenewModal(true);
  };

  const handleRenewForTenant = (tenant: TenantWithMembers) => {
    if (plans.length === 0) { showToast('No hay planes disponibles', 'error'); return; }
    setSelectedTenant(tenant);
    setShowRenewModal(true);
  };

  const handleConfirmRenew = async (planId: string) => {
    const externalUserId = selectedUser?.external_user_id || selectedTenant?.owner_user_id;
    if (!externalUserId) return;

    try {
      await adminApi.renewLicense(externalUserId, planId, applicationId);
      showToast('Licencia renovada exitosamente', 'success');
      await loadUsers();
      setShowRenewModal(false);
      setSelectedUser(null);
      setSelectedTenant(null);
    } catch (error: any) {
      showToast(error?.message || 'Error al renovar la licencia', 'error');
      throw error;
    }
  };

  const handleCancelForUser = (user: ApplicationUser) => {
    if (!user.subscription?.id) { showToast('No hay suscripción para cancelar', 'error'); return; }
    setSelectedUser(user);
    setShowConfirmCancel(true);
  };

  const handleCancelForTenant = (tenant: TenantWithMembers) => {
    if (!tenant.subscription?.id) { showToast('No hay suscripción para cancelar', 'error'); return; }
    setSelectedTenant(tenant);
    setShowConfirmCancel(true);
  };

  const handleConfirmCancel = async () => {
    setShowConfirmCancel(false);
    showToast('Funcionalidad de cancelación en desarrollo.', 'info');
    setSelectedUser(null);
    setSelectedTenant(null);
  };

  const handleAssignPlanToUser = async (user: ApplicationUser, planId: string) => {
    if (!user.tenant?.id) { showToast('Sin tenant asociado', 'error'); return; }
    try {
      setAssigningPlan(user.id);
      await adminApi.assignPlanToUser(user.external_user_id, planId, applicationId);
      showToast('Plan asignado exitosamente', 'success');
      await loadUsers();
    } catch (error) {
      showToast('Error al asignar el plan', 'error');
    } finally {
      setAssigningPlan(null);
    }
  };

  const handleAssignPlanToTenant = async (tenant: TenantWithMembers, planId: string) => {
    try {
      setAssigningPlan(tenant.id);
      await adminApi.assignPlanToUser(tenant.owner_user_id, planId, applicationId);
      showToast('Plan asignado exitosamente', 'success');
      await loadUsers();
    } catch (error) {
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
      showToast('Error al crear el tenant', 'error');
    } finally {
      setCreatingTenant(null);
    }
  };

  const isTenantMode = result?.mode === 'tenant';
  const tenants = isTenantMode ? (result?.data as TenantWithMembers[]) : [];
  const users = !isTenantMode ? (result?.data as ApplicationUser[]) : [];
  const totalUsers = result?.total_users || 0;

  // Determine renew modal subject name
  const renewSubjectName = selectedTenant?.name || selectedUser?.name || '';

  return (
    <>
      <ConfirmModal
        isOpen={showConfirmCancel}
        title="Cancelar Suscripción"
        message={`¿Estás seguro de cancelar la suscripción de ${selectedTenant?.name || selectedUser?.name}? Permanecerá activa hasta el final del período.`}
        confirmText="Cancelar Suscripción"
        cancelText="Volver"
        variant="warning"
        onConfirm={handleConfirmCancel}
        onCancel={() => { setShowConfirmCancel(false); setSelectedUser(null); setSelectedTenant(null); }}
      />

      <RenewLicenseModal
        isOpen={showRenewModal}
        user={selectedUser || (selectedTenant ? { ...selectedTenant, email: '', external_user_id: selectedTenant.owner_user_id } as any : null)!}
        plans={plans}
        onRenew={handleConfirmRenew}
        onClose={() => { setShowRenewModal(false); setSelectedUser(null); setSelectedTenant(null); }}
      />

      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-scale-in flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                {isTenantMode ? <Building2 className="w-5 h-5 text-blue-600" /> : <Users className="w-5 h-5 text-blue-600" />}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {isTenantMode ? 'Tenants de' : 'Usuarios de'} {applicationName}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {isTenantMode
                    ? `${tenants.length} tenant${tenants.length !== 1 ? 's' : ''} · ${totalUsers} usuario${totalUsers !== 1 ? 's' : ''} en total`
                    : `${totalUsers} usuario${totalUsers !== 1 ? 's' : ''} registrado${totalUsers !== 1 ? 's' : ''}`
                  }
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : isTenantMode ? (
              // Tenant mode
              tenants.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">No hay tenants registrados en esta aplicación</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tenants.map((tenant) => (
                    <TenantCard
                      key={tenant.id}
                      tenant={tenant}
                      plans={plans}
                      assigningPlan={assigningPlan}
                      onRenew={handleRenewForTenant}
                      onCancelSubscription={handleCancelForTenant}
                      onAssignPlan={handleAssignPlanToTenant}
                    />
                  ))}
                </div>
              )
            ) : (
              // Basic mode — flat user list
              users.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">No hay usuarios registrados en esta aplicación</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {users.map((user) => (
                    <div key={user.id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-all">
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
                              <span><span className="font-medium">Último acceso:</span> {formatDateTime(user.last_login)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <Calendar size={14} className="text-gray-400" />
                              <span><span className="font-medium">Registrado:</span> {formatDate(user.created_at)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">ID externo:</span>
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700">{user.external_user_id}</code>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full flex-shrink-0 ${statusBadge(user.status)}`}>
                          {statusLabel(user.status)}
                        </span>
                      </div>

                      {user.subscription || user.license ? (
                        <div className="border-t border-gray-200 pt-4 space-y-3">
                          {user.subscription && <SubscriptionBlock subscription={user.subscription} />}
                          {user.license && <LicenseBlock license={user.license} />}
                          <div className="flex gap-2 pt-1">
                            <button
                              className="flex-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                              onClick={() => handleRenewForUser(user)}
                            >
                              <RefreshCw size={14} /> Renovar Licencia
                            </button>
                            <button
                              className="flex-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                              onClick={() => handleCancelForUser(user)}
                            >
                              <XCircle size={14} /> Cancelar Suscripción
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="border-t border-gray-200 pt-4">
                          <div className="bg-yellow-50 rounded-lg p-3 flex items-start gap-2 mb-3">
                            <AlertCircle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-yellow-900">Sin licencia activa</p>
                              <p className="text-xs text-yellow-700 mt-0.5">Sin suscripción o licencia asignada.</p>
                            </div>
                          </div>

                          {plans.length > 0 && user.tenant && (
                            <div className="space-y-2">
                              <label className="block text-sm font-medium text-gray-700">Asignar plan:</label>
                              {plans.map((plan) => (
                                <button
                                  key={plan.id}
                                  onClick={() => handleAssignPlanToUser(user, plan.id)}
                                  disabled={assigningPlan === user.id}
                                  className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                  <div className="text-left">
                                    <p className="text-sm font-medium text-gray-900 group-hover:text-blue-900">{plan.name}</p>
                                    <p className="text-xs text-gray-600">
                                      {plan.currency} {Number(plan.price).toFixed(2)} / {plan.billing_cycle === 'monthly' ? 'mes' : 'año'}
                                      {plan.trial_days && plan.trial_days > 0 && <span className="ml-2 text-blue-600">• {plan.trial_days} días prueba</span>}
                                    </p>
                                  </div>
                                  <Plus size={18} className="text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
                                </button>
                              ))}
                            </div>
                          )}

                          {!user.tenant && (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                              <p className="text-xs text-gray-600 mb-3">Sin tenant asociado. Créalo para asignar un plan.</p>
                              <button
                                onClick={() => handleCreateTenant(user)}
                                disabled={creatingTenant === user.id}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium text-sm"
                              >
                                {creatingTenant === user.id ? (
                                  <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>Creando...</>
                                ) : (
                                  <><UserPlus size={16} />Crear Tenant</>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <p className="text-xs text-gray-500">Los usuarios se sincronizan automáticamente desde la aplicación externa</p>
            <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      </div>
    </>
  );
}
