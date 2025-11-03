import { useState, useEffect } from 'react';
import { AdminAPIService, type Tenant, type Application, type DashboardStats } from './lib/admin-api';
import {
  Users,
  Building2,
  Package,
  Activity,
  Plus,
  Settings,
  Search,
  Eye,
  Shield,
  CreditCard,
} from 'lucide-react';

function App() {
  const [adminApi] = useState(() => new AdminAPIService('admin_001'));
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'dashboard' | 'tenants' | 'applications'>('dashboard');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [showCreateTenantModal, setShowCreateTenantModal] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, tenantsData, appsData] = await Promise.all([
        adminApi.getStats(),
        adminApi.getTenants(),
        adminApi.getApplications(),
      ]);
      setStats(statsData);
      setTenants(tenantsData);
      setApplications(appsData);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
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
      loadDashboardData();
    } catch (error) {
      console.error('Failed to create tenant:', error);
      alert('Error al crear el cliente');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando panel de administración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="flex h-screen">
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Panel de Admin</h1>
                <p className="text-xs text-gray-500">Gestor de Suscripciones</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                activeView === 'dashboard'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Activity className="w-5 h-5" />
              <span className="font-medium">Inicio</span>
            </button>

            <button
              onClick={() => setActiveView('tenants')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                activeView === 'tenants'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Building2 className="w-5 h-5" />
              <span className="font-medium">Clientes</span>
            </button>

            <button
              onClick={() => setActiveView('applications')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                activeView === 'applications'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Package className="w-5 h-5" />
              <span className="font-medium">Aplicaciones</span>
            </button>
          </nav>

          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">Usuario Admin</p>
                <p className="text-xs text-gray-500 truncate">admin@ejemplo.com</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          {activeView === 'dashboard' && (
            <div className="p-8">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Inicio</h2>
                <p className="text-gray-600">Resumen de tu sistema de suscripciones</p>
              </div>

              <div className="grid md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-gray-600 mb-1">Total Clientes</h3>
                  <p className="text-3xl font-bold text-gray-900">{stats?.tenants_count || 0}</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-gray-600 mb-1">Suscripciones Activas</h3>
                  <p className="text-3xl font-bold text-gray-900">
                    {stats?.active_subscriptions || 0}
                  </p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Package className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-gray-600 mb-1">Aplicaciones</h3>
                  <p className="text-3xl font-bold text-gray-900">
                    {stats?.applications_count || 0}
                  </p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Activity className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-gray-600 mb-1">Ingresos Mensuales</h3>
                  <p className="text-3xl font-bold text-gray-900">$0</p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="p-6 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">Clientes Recientes</h3>
                </div>
                <div className="p-6">
                  {stats?.recent_tenants && stats.recent_tenants.length > 0 ? (
                    <div className="space-y-4">
                      {stats.recent_tenants.map((tenant) => (
                        <div
                          key={tenant.id}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Building2 className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{tenant.name}</p>
                              <p className="text-sm text-gray-500">{tenant.owner_email}</p>
                            </div>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
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
                  ) : (
                    <p className="text-gray-500 text-center py-8">No hay clientes aún</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeView === 'tenants' && (
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Clientes</h2>
                  <p className="text-gray-600">Gestiona organizaciones de clientes</p>
                </div>
                <button
                  onClick={() => setShowCreateTenantModal(true)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Crear Cliente
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="p-6 border-b border-gray-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar clientes..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Organización
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Propietario
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Aplicaciones
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {tenants.map((tenant) => (
                        <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{tenant.name}</p>
                                <p className="text-sm text-gray-500">{tenant.domain}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-900">{tenant.owner_email}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-900">
                              {tenant.tenant_applications?.length || 0} apps
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                tenant.status === 'active'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {tenant.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => setSelectedTenant(tenant)}
                              className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeView === 'applications' && (
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Aplicaciones</h2>
                  <p className="text-gray-600">Gestiona aplicaciones registradas</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <Package className="w-6 h-6 text-white" />
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          app.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {app.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{app.name}</h3>
                    <p className="text-sm text-gray-500 mb-4">{app.slug}</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">App ID:</span>
                        <span className="font-mono text-gray-900 text-xs">
                          {app.external_app_id}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">API Key:</span>
                        <span className="font-mono text-gray-900 text-xs">
                          {app.api_key.substring(0, 16)}...
                        </span>
                      </div>
                    </div>
                    <button className="mt-4 w-full bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2">
                      <Settings className="w-4 h-4" />
                      Configurar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {showCreateTenantModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Crear Nuevo Cliente</h2>
            </div>

            <form onSubmit={handleCreateTenant} className="p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre del Cliente
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Acme Corp"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre de la Organización
                  </label>
                  <input
                    type="text"
                    name="organization_name"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Corporación Acme"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ID de Usuario Propietario
                  </label>
                  <input
                    type="text"
                    name="owner_user_id"
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="user_123abc"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email del Propietario
                  </label>
                  <input
                    type="email"
                    name="owner_email"
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="owner@acme.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email de Facturación
                  </label>
                  <input
                    type="email"
                    name="billing_email"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="billing@acme.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dominio</label>
                  <input
                    type="text"
                    name="domain"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="acme.com"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateTenantModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  Crear Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
