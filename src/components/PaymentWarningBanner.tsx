import React, { useState } from 'react';
import { AlertCircle, CreditCard, X } from 'lucide-react';
import { Button } from './Button';
import { RegisterPaymentModal } from './RegisterPaymentModal';

interface PaymentWarningBannerProps {
  externalUserId: string;
  externalAppId: string;
  userEmail: string;
  planName: string;
  trialEndDate?: string;
  daysUntilTrialEnd: number;
  onPaymentRegistered?: () => void;
}

export function PaymentWarningBanner({
  externalUserId,
  externalAppId,
  userEmail,
  planName,
  trialEndDate,
  daysUntilTrialEnd,
  onPaymentRegistered,
}: PaymentWarningBannerProps) {
  const [showModal, setShowModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const isUrgent = daysUntilTrialEnd <= 3;
  const bgColor = isUrgent ? 'bg-red-50' : 'bg-yellow-50';
  const borderColor = isUrgent ? 'border-red-200' : 'border-yellow-200';
  const textColor = isUrgent ? 'text-red-900' : 'text-yellow-900';
  const iconColor = isUrgent ? 'text-red-600' : 'text-yellow-600';

  return (
    <>
      <div className={`${bgColor} border ${borderColor} rounded-lg p-4 mb-6`}>
        <div className="flex items-start gap-3">
          <AlertCircle className={`${iconColor} flex-shrink-0 mt-0.5`} size={20} />
          <div className="flex-1">
            <h3 className={`text-sm font-semibold ${textColor}`}>
              {isUrgent
                ? '¡Acción requerida! Tu período de prueba está por finalizar'
                : 'Registra tu método de pago'}
            </h3>
            <p className={`text-sm ${textColor} mt-1`}>
              {daysUntilTrialEnd > 0 ? (
                <>
                  Tu período de prueba finaliza en{' '}
                  <span className="font-semibold">
                    {daysUntilTrialEnd} {daysUntilTrialEnd === 1 ? 'día' : 'días'}
                  </span>
                  . Registra tu método de pago ahora para continuar sin interrupciones.
                </>
              ) : (
                <>
                  Tu período de prueba ha finalizado. Registra tu método de pago para reactivar tu
                  cuenta.
                </>
              )}
            </p>
            <div className="mt-3">
              <Button
                onClick={() => setShowModal(true)}
                size="sm"
                className="inline-flex items-center gap-2"
              >
                <CreditCard size={16} />
                Registrar Método de Pago
              </Button>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className={`${iconColor} hover:opacity-70 transition-opacity`}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <RegisterPaymentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        externalUserId={externalUserId}
        externalAppId={externalAppId}
        userEmail={userEmail}
        planName={planName}
        trialEndDate={trialEndDate}
        onSuccess={() => {
          setShowModal(false);
          onPaymentRegistered?.();
        }}
      />
    </>
  );
}
