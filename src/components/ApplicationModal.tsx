import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { type Application } from '../lib/admin-api';

interface ApplicationModalProps {
  application?: Application;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

export function ApplicationModal({ application, onClose, onSave }: ApplicationModalProps) {
  const [formData, setFormData] = useState({
    name: application?.name || '',
    slug: application?.slug || '',
    external_app_id: application?.external_app_id || '',
    webhook_url: application?.webhook_url || '',
  });
  const [saving, setSaving] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save application:', error);
      alert('Error al guardar la aplicación');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedApiKey(true);
    setTimeout(() => setCopiedApiKey(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {application ? 'Configurar Aplicación' : 'Nueva Aplicación'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {application && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <label className="block text-sm font-medium text-blue-900 mb-2">API Key</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={application.api_key}
                  readOnly
                  className="flex-1 px-4 py-2 bg-white border border-blue-300 rounded-lg font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(application.api_key)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  {copiedApiKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedApiKey ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <p className="text-xs text-blue-700 mt-2">
                Guarda esta API Key. La necesitarás para integrar esta aplicación.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de la Aplicación *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
              disabled={!!application}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="Mi Sistema CRM"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Slug *
            </label>
            <input
              type="text"
              value={formData.slug}
              onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
              required
              disabled={!!application}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 font-mono"
              placeholder="mi-sistema-crm"
            />
            <p className="text-xs text-gray-500 mt-1">Identificador único en minúsculas (ej: mi-app)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              External App ID *
            </label>
            <input
              type="text"
              value={formData.external_app_id}
              onChange={e => setFormData({ ...formData, external_app_id: e.target.value })}
              required
              disabled={!!application}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 font-mono"
              placeholder="app_001"
            />
            <p className="text-xs text-gray-500 mt-1">ID de tu aplicación en tu sistema</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Webhook URL (opcional)
            </label>
            <input
              type="url"
              value={formData.webhook_url}
              onChange={e => setFormData({ ...formData, webhook_url: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://mi-app.com/webhook"
            />
            <p className="text-xs text-gray-500 mt-1">URL para recibir notificaciones de eventos</p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : (application ? 'Guardar Cambios' : 'Crear Aplicación')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 border border-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
