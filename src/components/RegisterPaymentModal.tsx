import React, { useState } from 'react';
import { X, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from './Button';

interface RegisterPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  externalUserId: string;
  externalAppId: string;
  userEmail: string;
  planName: string;
  trialEndDate?: string;
  onSuccess?: () => void;
}

export function RegisterPaymentModal({
  isOpen,
  onClose,
  externalUserId,
  externalAppId,
  userEmail,
  planName,
  trialEndDate,
  onSuccess,
}: RegisterPaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState(userEmail);

  if (!isOpen) return null;

  const handleRegisterPayment = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/recurring-subscriptions/create-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
          },
          body: JSON.stringify({
            external_user_id: externalUserId,
            external_app_id: externalAppId,
            payer_email: email,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to register payment method');
      }

      if (data.data.checkout_url) {
        window.location.href = data.data.checkout_url;
      } else {
        setError('No checkout URL received');
      }
    } catch (err) {
      console.error('Error registering payment:', err);
      setError(err instanceof Error ? err.message : 'Failed to register payment method');
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const daysUntilTrialEnd = trialEndDate
    ? Math.ceil((new Date(trialEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <CreditCard className="text-blue-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Registrar Método de Pago
              </h2>
              <p className="text-sm text-gray-500">
                Activa los pagos automáticos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {daysUntilTrialEnd > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">
                    Período de prueba activo
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Tu prueba gratuita finaliza el{' '}
                    <span className="font-semibold">{formatDate(trialEndDate)}</span>
                    {' '}({daysUntilTrialEnd} {daysUntilTrialEnd === 1 ? 'día' : 'días'} restantes).
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Plan:</span>
              <span className="text-sm font-semibold text-gray-900">{planName}</span>
            </div>
            <div className="border-t border-gray-200 pt-3">
              <p className="text-xs text-gray-500 mb-2">
                Al registrar tu método de pago:
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-gray-700">
                  <CheckCircle size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Los pagos se procesarán automáticamente</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-gray-700">
                  <CheckCircle size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                  <span>No perderás acceso a tu cuenta</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-gray-700">
                  <CheckCircle size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Puedes cancelar en cualquier momento</span>
                </li>
              </ul>
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email para facturación
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="tu@email.com"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Recibirás los recibos de pago en este email
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              onClick={onClose}
              variant="secondary"
              disabled={loading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRegisterPayment}
              disabled={loading || !email}
              className="flex-1"
            >
              {loading ? 'Procesando...' : 'Continuar con MercadoPago'}
            </Button>
          </div>

          <p className="text-xs text-center text-gray-500">
            Serás redirigido a MercadoPago para completar el registro de forma segura
          </p>
        </div>
      </div>
    </div>
  );
}
