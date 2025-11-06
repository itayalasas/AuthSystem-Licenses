import { useState, useEffect } from 'react';
import { AuthService, type AuthUser } from '../lib/auth';
import {
  AdminAPIService,
  type Tenant,
  type Application,
  type DashboardStats,
  type Plan,
} from '../lib/admin-api';
import {
  Users,
  Building2,
  Package,
  Activity,
  LogOut,
  User,
  BookOpen,
  DollarSign,
  RefreshCw,
  Shield,
  CreditCard,
} from 'lucide-react';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { StatCard } from '../components/StatCard';
import { Button } from '../components/Button';
import { TenantsView } from '../components/TenantsView';
import { ApplicationsView } from '../components/ApplicationsView';
import { TenantDetailModal } from '../components/TenantDetailModal';
import { ApplicationModal } from '../components/ApplicationModal';
import { PlanModal } from '../components/PlanModal';
import { ApplicationUsersModal } from '../components/ApplicationUsersModal';
import { ApplicationPlansModal } from '../components/ApplicationPlansModal';
import { PlanCard } from '../components/PlanCard';
import { PendingPaymentsView } from '../components/PendingPaymentsView';

export function Dashboard() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [adminApi] = useState(() => new AdminAPIService('admin_001'));
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'applications' | 'plans' | 'payments' | 'manual'>(
    'dashboard'
  );
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [showCreateTenantModal, setShowCreateTenantModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [selectedAppForUsers, setSelectedAppForUsers] = useState<Application | null>(null);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [selectedAppForPlans, setSelectedAppForPlans] = useState<Application | null>(null);
  const { toasts, removeToast, success, error: showError, info } = useToast();

  useEffect(() => {
    const currentUser = AuthService.getUser();
    if (!currentUser) {
      window.location.href = '/';
      return;
    }

    if (AuthService.isTokenExpired(AuthService.getTokens()?.token || '')) {
      AuthService.refreshToken().then((isSuccess) => {
        if (!isSuccess) {
          AuthService.logout();
        }
      });
    }

    setUser(currentUser);
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, tenantsData, appsData, plansData] = await Promise.all([
        adminApi.getStats(),
        adminApi.getTenants(),
        adminApi.getApplications(),
        adminApi.getPlans(),
      ]);
      setStats(statsData);
      setTenants(tenantsData);
      setApplications(appsData);
      setPlans(plansData);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      showError('Error al cargar los datos del dashboard');
      setStats({ tenants_count: 0, active_subscriptions: 0, applications_count: 0, recent_tenants: [] });
      setTenants([]);
      setApplications([]);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshTenants = async () => {
    try {
      const [tenantsData, statsData] = await Promise.all([
        adminApi.getTenants(),
        adminApi.getStats(),
      ]);
      setTenants(tenantsData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to refresh tenants:', err);
    }
  };

  const refreshApplications = async () => {
    try {
      const [appsData, statsData] = await Promise.all([
        adminApi.getApplications(),
        adminApi.getStats(),
      ]);
      setApplications(appsData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to refresh applications:', err);
    }
  };

  const refreshPlans = async () => {
    try {
      const plansData = await adminApi.getPlans();
      setPlans(plansData);
    } catch (err) {
      console.error('Failed to refresh plans:', err);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      await adminApi.createTenant({
        name: formData.get('name') as string,
        organization_name: formData.get('organization_name') as string,
        owner_user_id: formData.get('owner_user_id') as string,
        owner_email: formData.get('owner_email') as string,
        billing_email: formData.get('billing_email') as string,
        domain: formData.get('domain') as string,
      });

      setShowCreateTenantModal(false);
      success('Cliente creado exitosamente');
      await refreshTenants();
    } catch (err) {
      console.error('Failed to create tenant:', err);
      showError('Error al crear el cliente');
    }
  };

  const handleLogout = () => {
    AuthService.logout();
  };

  const handleCreateApplication = async (data: any) => {
    try {
      await adminApi.createApplication(data);
      setShowApplicationModal(false);
      setSelectedApplication(null);
      success('Aplicación creada exitosamente');
      await refreshApplications();
    } catch (err) {
      showError('Error al crear la aplicación');
    }
  };

  const handleUpdateApplication = async (data: any) => {
    if (!selectedApplication) return;

    try {
      await adminApi.updateApplication(selectedApplication.id, data);
      setShowApplicationModal(false);
      setSelectedApplication(null);
      success('Aplicación actualizada exitosamente');
      await refreshApplications();
    } catch (err) {
      showError('Error al actualizar la aplicación');
    }
  };

  const handleDeleteApplication = async (applicationId: string) => {
    try {
      await adminApi.deleteApplication(applicationId);
      success('Aplicación eliminada exitosamente');
      await refreshApplications();
    } catch (err) {
      showError('Error al eliminar la aplicación');
    }
  };

  const handleSyncApplications = async () => {
    try {
      setSyncing(true);
      info('Sincronizando aplicaciones...');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-applications`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const result = await response.json();

      if (result.success) {
        const summary = result.summary;
        success(
          `Sincronización completada: ${summary.newly_created} apps nuevas, ` +
          `${summary.total_users_synced} usuarios, ${summary.total_tenants_created} clientes creados, ` +
          `${summary.total_relationships_created} relaciones establecidas`
        );
        await Promise.all([refreshApplications(), refreshTenants()]);
      } else {
        showError(`Error en la sincronización: ${result.error}`);
      }
    } catch (err) {
      console.error('Failed to sync applications:', err);
      showError('Error al sincronizar aplicaciones');
    } finally {
      setSyncing(false);
    }
  };

  const handleCreatePlan = async (data: any) => {
    try {
      await adminApi.createPlan(data);
      setShowPlanModal(false);
      setSelectedPlan(null);
      success('Plan creado exitosamente');
      await refreshPlans();
    } catch (err) {
      showError('Error al crear el plan');
    }
  };

  const handleViewAppPlans = (app: Application) => {
    setSelectedAppForPlans(app);
    setShowPlansModal(true);
  };

  const handleAssignExistingPlan = async (planId: string) => {
    if (!selectedAppForPlans) return;

    try {
      await adminApi.assignExistingPlanToApplication(planId, selectedAppForPlans.id);
      success('Plan asignado exitosamente');
      await refreshPlans();
    } catch (err) {
      showError('Error al asignar el plan');
    }
  };

  const handleUpdatePlan = async (data: any) => {
    if (!selectedPlan) return;

    try {
      await adminApi.updatePlan(selectedPlan.id, data);
      setShowPlanModal(false);
      setSelectedPlan(null);
      success('Plan actualizado exitosamente');
      await refreshPlans();
    } catch (err) {
      showError('Error al actualizar el plan');
    }
  };

  const handleDeletePlan = async (planId: string) => {
    try {
      await adminApi.deletePlan(planId);
      success('Plan eliminado exitosamente');
      await refreshPlans();
    } catch (err) {
      showError('Error al eliminar el plan');
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Admin Panel</h1>
                <p className="text-xs text-gray-500">Subscription Manager</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSyncApplications}
                loading={syncing}
                icon={<RefreshCw size={14} />}
              >
                Sincronizar
              </Button>

              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{user.name}</span>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 animate-scale-in">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut size={14} />
                      Cerrar Sesión
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Side Navigation */}
      <div className="flex">
        <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)] sticky top-16">
          <nav className="p-4 space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Activity },
              { id: 'applications', label: 'Aplicaciones', icon: Package },
              { id: 'plans', label: 'Planes', icon: DollarSign },
              { id: 'payments', label: 'Pagos', icon: CreditCard },
              { id: 'manual', label: 'Documentación', icon: BookOpen },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveView(id as any)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeView === id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {activeView === 'dashboard' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Resumen general del sistema
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    title="Total Clientes"
                    value={stats?.tenants_count || 0}
                    icon={Users}
                    color="blue"
                  />
                  <StatCard
                    title="Suscripciones Activas"
                    value={stats?.active_subscriptions || 0}
                    icon={Activity}
                    color="green"
                  />
                  <StatCard
                    title="Aplicaciones"
                    value={stats?.applications_count || 0}
                    icon={Package}
                    color="purple"
                  />
                  <StatCard
                    title="Planes Disponibles"
                    value={plans.length}
                    icon={DollarSign}
                    color="orange"
                  />
                </div>

                {/* Recent Tenants */}
                {stats?.recent_tenants && stats.recent_tenants.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Clientes Recientes
                    </h3>
                    <div className="space-y-3">
                      {stats.recent_tenants.slice(0, 5).map((tenant) => (
                        <div
                          key={tenant.id}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => setSelectedTenant(tenant)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Building2 className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{tenant.name}</p>
                              <p className="text-xs text-gray-500">{tenant.owner_email}</p>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              tenant.status === 'active'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {tenant.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeView === 'applications' && (
              <div className="animate-fade-in">
                <ApplicationsView
                  applications={applications}
                  plans={plans}
                  onAdd={() => {
                    setSelectedApplication(null);
                    setShowApplicationModal(true);
                  }}
                  onEdit={(app) => {
                    setSelectedApplication(app);
                    setShowApplicationModal(true);
                  }}
                  onDelete={handleDeleteApplication}
                  onViewUsers={(app) => {
                    setSelectedAppForUsers(app);
                    setShowUsersModal(true);
                  }}
                  onViewPlans={handleViewAppPlans}
                />
              </div>
            )}

            {activeView === 'plans' && (
              <div className="animate-fade-in space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Planes</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Gestiona los planes de suscripción
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setSelectedPlan(null);
                      setShowPlanModal(true);
                    }}
                    icon={<DollarSign size={16} />}
                  >
                    Nuevo Plan
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {plans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      onEdit={(p) => {
                        setSelectedPlan(p);
                        setShowPlanModal(true);
                      }}
                      onDelete={handleDeletePlan}
                    />
                  ))}
                </div>
              </div>
            )}

            {activeView === 'payments' && (
              <div className="animate-fade-in">
                <PendingPaymentsView />
              </div>
            )}

            {activeView === 'manual' && (
              <div className="animate-fade-in">
                <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-8 mb-6 text-white">
                  <div className="flex items-center gap-3 mb-3">
                    <BookOpen className="w-8 h-8" />
                    <h2 className="text-3xl font-bold">Documentación de APIs</h2>
                  </div>
                  <p className="text-blue-100 mb-6">
                    Explora todas las APIs disponibles con ejemplos de código, parámetros y respuestas
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => window.open('/api-docs', '_blank')}
                    icon={<BookOpen size={16} />}
                  >
                    Abrir Documentación Completa
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">APIs Disponibles</h3>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        <span>Validation API - Validación de usuarios y licencias</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                        <span>Tenant Onboarding - Registro de nuevos usuarios</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                        <span>Payment Processor - Consulta de suscripciones</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                        <span>Payment Manager - Gestión de pagos</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                        <span>Admin API - Administración del sistema</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Recursos Adicionales</h3>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li className="flex items-center gap-2">
                        <BookOpen size={16} className="text-blue-600" />
                        <code className="bg-gray-100 px-2 py-1 rounded">MANUAL_DE_USO.md</code>
                      </li>
                      <li className="flex items-center gap-2">
                        <BookOpen size={16} className="text-blue-600" />
                        <code className="bg-gray-100 px-2 py-1 rounded">INTEGRACION_PARA_DESARROLLADORES.md</code>
                      </li>
                      <li className="flex items-center gap-2">
                        <BookOpen size={16} className="text-blue-600" />
                        <code className="bg-gray-100 px-2 py-1 rounded">GUIA_COMPLETA_API_EXTERNAS_v2.md</code>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      {selectedTenant && (
        <TenantDetailModal
          tenant={selectedTenant}
          applications={applications}
          plans={plans}
          adminApi={adminApi}
          onClose={() => setSelectedTenant(null)}
          onUpdate={() => {
            refreshTenants();
            success('Cliente actualizado exitosamente');
          }}
        />
      )}

      {showCreateTenantModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Crear Nuevo Cliente</h2>
            </div>
            <form onSubmit={handleCreateTenant} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Cliente
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la Organización
                </label>
                <input
                  type="text"
                  name="organization_name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID del Usuario Propietario
                </label>
                <input
                  type="text"
                  name="owner_user_id"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email del Propietario
                </label>
                <input
                  type="email"
                  name="owner_email"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email de Facturación
                </label>
                <input
                  type="email"
                  name="billing_email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dominio
                </label>
                <input
                  type="text"
                  name="domain"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1">
                  Crear Cliente
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreateTenantModal(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showApplicationModal && (
        <ApplicationModal
          application={selectedApplication}
          onClose={() => {
            setShowApplicationModal(false);
            setSelectedApplication(null);
          }}
          onCreate={handleCreateApplication}
          onUpdate={handleUpdateApplication}
        />
      )}

      {showPlanModal && (
        <PlanModal
          plan={selectedPlan}
          applications={applications}
          onClose={() => {
            setShowPlanModal(false);
            setSelectedPlan(null);
          }}
          onCreate={handleCreatePlan}
          onUpdate={handleUpdatePlan}
          adminApi={adminApi}
        />
      )}

      {showUsersModal && selectedAppForUsers && (
        <ApplicationUsersModal
          applicationId={selectedAppForUsers.id}
          applicationName={selectedAppForUsers.name}
          adminApi={adminApi}
          onClose={() => {
            setShowUsersModal(false);
            setSelectedAppForUsers(null);
          }}
        />
      )}

      {showPlansModal && selectedAppForPlans && (
        <ApplicationPlansModal
          application={selectedAppForPlans}
          plans={plans.filter(p => p.application_id === selectedAppForPlans.id)}
          allPlans={plans}
          onClose={() => {
            setShowPlansModal(false);
            setSelectedAppForPlans(null);
          }}
          onAddPlan={() => {
            setShowPlansModal(false);
            setSelectedPlan(null);
            setShowPlanModal(true);
          }}
          onEditPlan={(plan) => {
            setShowPlansModal(false);
            setSelectedPlan(plan);
            setShowPlanModal(true);
          }}
          onDeletePlan={handleDeletePlan}
          onAssignExistingPlan={handleAssignExistingPlan}
        />
      )}
    </div>
  );
}
