import { useState } from 'react';
import { X, Copy, Check, Trash2, ArrowRightLeft } from 'lucide-react';
import { type Application } from '../lib/admin-api';
import { ConfirmModal } from './ConfirmModal';
import { useToast } from '../hooks/useToast';

function buildCallbackUrl(applicationId: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  if (!supabaseUrl) return `/functions/v1/subscription-callback?app_id=${encodeURIComponent(applicationId)}`;
  try {
    const u = new URL(`${supabaseUrl}/functions/v1/subscription-callback`);
    u.searchParams.set('app_id', applicationId);
    return u.toString();
  } catch {
    return `${supabaseUrl}/functions/v1/subscription-callback?app_id=${encodeURIComponent(applicationId)}`;
  }
}

interface ApplicationModalProps {
  application?: Application;
  onClose: () => void;
  onCreate?: (data: any) => Promise<void>;
  onUpdate?: (data: any) => Promise<void>;
  onDelete?: (applicationId: string) => Promise<void>;
}

export function ApplicationModal({ application, onClose, onCreate, onUpdate, onDelete }: ApplicationModalProps) {
  const [formData, setFormData] = useState({
    name: application?.name || '',
    slug: application?.slug || '',
    external_app_id: application?.external_app_id || '',
    webhook_url: application?.webhook_url || '',
    back_url: (application as any)?.back_url || '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [copiedCallback, setCopiedCallback] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (application) {
        await onUpdate?.(formData);
      } else {
        await onCreate?.(formData);
      }
    } catch (error) {
      console.error('Failed to save application:', error);
      showToast('Error al guardar la aplicación', 'error');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedApiKey(true);
    setTimeout(() => setCopiedApiKey(false), 2000);
  };

  const copyCallbackUrl = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCallback(true);
    setTimeout(() => setCopiedCallback(false), 2000);
  };

  const handleDeleteClick = () => {
    setShowConfirmDelete(true);
  };

  const handleConfirmDelete = async () => {
    if (!application || !onDelete) return;

    try {
      setDeleting(true);
      setShowConfirmDelete(false);
      await onDelete(application.id);
      showToast('Aplicación eliminada exitosamente', 'success');
      onClose();
    } catch (error) {
      console.error('Failed to delete application:', error);
      showToast('Error al eliminar la aplicación', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <ConfirmModal
        isOpen={showConfirmDelete}
        title="Confirmar Eliminación"
        message={`¿Estás seguro de eliminar "${application?.name}"? Esta acción no se puede deshacer y se perderá toda la información asociada.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowConfirmDelete(false)}
      />

      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full my-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white rounded-t-xl z-10">
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
              Webhook URL <span className="text-gray-400 font-normal">(opcional)</span>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL de retorno tras pago <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="url"
              value={formData.back_url}
              onChange={e => setFormData({ ...formData, back_url: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://mi-app.com/suscripcion/resultado"
            />
            <p className="text-xs text-gray-500 mt-1">
              Tras el checkout de MercadoPago, el usuario llegará aquí con{' '}
              <code className="bg-gray-100 px-1 rounded">subscription_status</code>,{' '}
              <code className="bg-gray-100 px-1 rounded">subscription_id</code> y{' '}
              <code className="bg-gray-100 px-1 rounded">plan_id</code>
            </p>
          </div>

          {application && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-amber-700 flex-shrink-0" />
                <span className="text-sm font-semibold text-amber-900">URL de callback para MercadoPago</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Esta es la URL que debes configurar como <strong>back_url</strong> al crear el plan en MercadoPago
                (o pasarla al front del tenant para que la use al redirigir al checkout).
                Esta plataforma intercepta el retorno, resuelve el estado de la suscripción y redirige
                al usuario a la "URL de retorno tras pago" de arriba.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={buildCallbackUrl(application.id)}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded-lg font-mono text-xs text-gray-700 select-all"
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <button
                  type="button"
                  onClick={() => copyCallbackUrl(buildCallbackUrl(application.id))}
                  className="px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-1.5 text-sm font-medium flex-shrink-0"
                >
                  {copiedCallback ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedCallback ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <p className="text-xs text-amber-700">
                Parametros que MP devuelve al redirigir:{' '}
                <code className="bg-amber-100 px-1 rounded">?preapproval_id=xxx&amp;app_id={application.id}</code>
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={saving || deleting}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : (application ? 'Guardar Cambios' : 'Crear Aplicación')}
            </button>
            {application && onDelete && (
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={saving || deleting}
                className="px-6 border border-red-300 text-red-600 py-3 rounded-lg font-medium hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={saving || deleting}
              className="px-6 border border-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}
