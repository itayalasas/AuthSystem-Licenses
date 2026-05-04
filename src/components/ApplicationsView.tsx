import { useState } from 'react';
import { Application, Plan } from '../lib/admin-api';
import { CompactCard } from './CompactCard';
import { Button } from './Button';
import { ConfirmModal } from './ConfirmModal';
import { Plus, Users, Globe, CreditCard as Edit2, Trash2, Key, Eye, Package, UserCheck, Building2, Layers } from 'lucide-react';

interface ApplicationsViewProps {
  applications: Application[];
  plans: Plan[];
  onAdd: () => void;
  onEdit: (app: Application) => void;
  onDelete: (appId: string) => void;
  onViewUsers: (app: Application) => void;
  onViewPlans: (app: Application) => void;
}

export function ApplicationsView({ applications, plans, onAdd, onEdit, onDelete, onViewUsers, onViewPlans }: ApplicationsViewProps) {
  const [appToDelete, setAppToDelete] = useState<Application | null>(null);

  const getAppPlans = (appId: string) => plans.filter(plan => plan.application_id === appId);

  const authTypeBadge = (authType: string) => {
    switch (authType) {
      case 'tenant':
        return { icon: <Building2 size={11} />, label: 'Tenant', cls: 'bg-blue-100 text-blue-700' };
      case 'hybrid':
        return { icon: <Layers size={11} />, label: 'Híbrido', cls: 'bg-amber-100 text-amber-700' };
      default:
        return { icon: <UserCheck size={11} />, label: 'Básico', cls: 'bg-gray-100 text-gray-600' };
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Aplicaciones</h2>
            <p className="text-sm text-gray-600 mt-1">
              Gestiona las aplicaciones registradas en el sistema
            </p>
          </div>
          <Button onClick={onAdd} icon={<Plus size={16} />}>
            Nueva Aplicación
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {applications.map((app) => {
            const appPlans = getAppPlans(app.id);

            return (
              <CompactCard key={app.id} hover className="group">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{app.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{app.slug}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        app.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {app.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                      {(() => {
                        const badge = authTypeBadge(app.auth_type || 'basic');
                        return (
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1 ${badge.cls}`}>
                            {badge.icon}
                            {badge.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onViewUsers(app); }}
                      className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 hover:underline w-full"
                    >
                      <Users size={14} className="flex-shrink-0" />
                      <span>
                        {app.users_count || 0}
                        {app.max_users ? ` / ${app.max_users}` : ''} usuarios
                      </span>
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); onViewPlans(app); }}
                      className="flex items-center gap-2 text-xs text-green-600 hover:text-green-700 hover:underline w-full font-medium"
                    >
                      <Package size={14} className="flex-shrink-0" />
                      <span>
                        {appPlans.length} {appPlans.length === 1 ? 'plan' : 'planes'} - Ver Planes
                      </span>
                    </button>

                    {app.webhook_url && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Globe size={14} className="flex-shrink-0" />
                        <span className="truncate">{app.webhook_url}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs">
                      <Key size={14} className="text-gray-400 flex-shrink-0" />
                      <code className="font-mono text-gray-900 truncate bg-gray-50 px-2 py-0.5 rounded">
                        {app.api_key}
                      </code>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); onViewUsers(app); }}
                      icon={<Eye size={14} />}
                      className="text-blue-600 hover:bg-blue-50"
                    >
                      Usuarios
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); onViewPlans(app); }}
                      icon={<Package size={14} />}
                      className="text-green-600 hover:bg-green-50"
                    >
                      Planes
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); onEdit(app); }}
                      icon={<Edit2 size={14} />}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setAppToDelete(app); }}
                      icon={<Trash2 size={14} />}
                      className="text-red-600 hover:bg-red-50"
                    >
                      Borrar
                    </Button>
                  </div>
                </div>
              </CompactCard>
            );
          })}
        </div>

        {applications.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
              <Globe className="text-gray-400" size={32} />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay aplicaciones registradas
            </h3>
            <p className="text-gray-600 mb-6">
              Comienza agregando tu primera aplicación al sistema
            </p>
            <Button onClick={onAdd} icon={<Plus size={16} />}>
              Crear Aplicación
            </Button>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!appToDelete}
        title={`Eliminar "${appToDelete?.name}"`}
        message="Se eliminará la aplicación del sistema. Esta acción no se puede deshacer."
        confirmText="Eliminar aplicación"
        variant="danger"
        onConfirm={() => {
          if (appToDelete) onDelete(appToDelete.id);
          setAppToDelete(null);
        }}
        onCancel={() => setAppToDelete(null)}
      />
    </>
  );
}
