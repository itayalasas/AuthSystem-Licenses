import { Application, Plan } from '../lib/admin-api';
import { CompactCard } from './CompactCard';
import { Button } from './Button';
import { PlanSelector } from './PlanSelector';
import { Plus, Users, Globe, Edit2, Trash2, Key, Eye } from 'lucide-react';

interface ApplicationsViewProps {
  applications: Application[];
  plans: Plan[];
  onAdd: () => void;
  onEdit: (app: Application) => void;
  onDelete: (appId: string) => void;
  onViewUsers: (app: Application) => void;
  onAssignPlan: (app: Application, planId: string) => Promise<void>;
}

export function ApplicationsView({ applications, plans, onAdd, onEdit, onDelete, onViewUsers, onAssignPlan }: ApplicationsViewProps) {
  return (
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
        {applications.map((app) => (
          <CompactCard key={app.id} hover className="group">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{app.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{app.slug}</p>
                </div>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${
                    app.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {app.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <div className="space-y-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewUsers(app);
                  }}
                  className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                >
                  <Users size={14} className="flex-shrink-0" />
                  <span>
                    {app.users_count || 0}
                    {app.max_users ? ` / ${app.max_users}` : ''} usuarios
                  </span>
                </button>

                <PlanSelector
                  app={app}
                  plans={plans}
                  onAssignPlan={onAssignPlan}
                />
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

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewUsers(app);
                  }}
                  icon={<Eye size={14} />}
                  className="text-blue-600 hover:bg-blue-50"
                >
                  Ver
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(app);
                  }}
                  icon={<Edit2 size={14} />}
                >
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('¿Eliminar esta aplicación?')) {
                      onDelete(app.id);
                    }
                  }}
                  icon={<Trash2 size={14} />}
                  className="text-red-600 hover:bg-red-50"
                >
                  Borrar
                </Button>
              </div>
            </div>
          </CompactCard>
        ))}
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
  );
}
