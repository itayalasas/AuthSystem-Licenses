import { Tenant } from '../lib/admin-api';
import { CompactCard } from './CompactCard';
import { Button } from './Button';
import { Plus, Building2, Mail, Calendar, Eye } from 'lucide-react';

interface TenantsViewProps {
  tenants: Tenant[];
  onAdd: () => void;
  onView: (tenant: Tenant) => void;
}

export function TenantsView({ tenants, onAdd, onView }: TenantsViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Clientes</h2>
          <p className="text-sm text-gray-600 mt-1">
            Administra los clientes y sus suscripciones
          </p>
        </div>
        <Button onClick={onAdd} icon={<Plus size={16} />}>
          Nuevo Cliente
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tenants.map((tenant) => {
          const appCount = tenant.tenant_applications?.length || 0;
          const activeApps = tenant.tenant_applications?.filter(ta => ta.status === 'active').length || 0;

          return (
            <CompactCard key={tenant.id} hover className="group cursor-pointer" onClick={() => onView(tenant)}>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{tenant.name}</h3>
                    {tenant.organization_name && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {tenant.organization_name}
                      </p>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${
                      tenant.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : tenant.status === 'suspended'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {tenant.status === 'active' ? 'Activo' : tenant.status === 'suspended' ? 'Suspendido' : 'Cancelado'}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Mail size={14} className="flex-shrink-0" />
                    <span className="truncate">{tenant.owner_email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Building2 size={14} className="flex-shrink-0" />
                    <span>
                      {activeApps} de {appCount} aplicaciones activas
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Calendar size={14} className="flex-shrink-0" />
                    <span>Desde {new Date(tenant.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onView(tenant)}
                    icon={<Eye size={14} />}
                    className="w-full"
                  >
                    Ver Detalles
                  </Button>
                </div>
              </div>
            </CompactCard>
          );
        })}
      </div>

      {tenants.length === 0 && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
            <Building2 className="text-gray-400" size={32} />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay clientes registrados
          </h3>
          <p className="text-gray-600 mb-6">
            Agrega tu primer cliente para comenzar
          </p>
          <Button onClick={onAdd} icon={<Plus size={16} />}>
            Crear Cliente
          </Button>
        </div>
      )}
    </div>
  );
}
