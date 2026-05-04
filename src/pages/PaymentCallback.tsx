import { useEffect, useRef, useState } from 'react';
import { CheckCircle, Clock, XCircle, PauseCircle, Loader2 } from 'lucide-react';

type PaymentStatus = 'authorized' | 'pending' | 'cancelled' | 'paused' | 'unknown';

const STATUS_CONFIG: Record<PaymentStatus, {
  icon: React.ReactNode;
  title: string;
  message: string;
  color: string;
}> = {
  authorized: {
    icon: <CheckCircle className="w-14 h-14 text-green-500" />,
    title: 'Suscripción activada',
    message: 'Tu suscripción fue confirmada exitosamente. Redirigiendo a la aplicación...',
    color: 'text-green-600',
  },
  pending: {
    icon: <Clock className="w-14 h-14 text-amber-500" />,
    title: 'Pago en proceso',
    message: 'Tu pago está siendo procesado. Redirigiendo...',
    color: 'text-amber-600',
  },
  cancelled: {
    icon: <XCircle className="w-14 h-14 text-red-500" />,
    title: 'Suscripción cancelada',
    message: 'La suscripción fue cancelada. Redirigiendo...',
    color: 'text-red-600',
  },
  paused: {
    icon: <PauseCircle className="w-14 h-14 text-blue-500" />,
    title: 'Suscripción pausada',
    message: 'Tu suscripción está pausada. Redirigiendo...',
    color: 'text-blue-600',
  },
  unknown: {
    icon: <Loader2 className="w-14 h-14 text-gray-400 animate-spin" />,
    title: 'Confirmando pago',
    message: 'Estamos verificando el estado de tu pago...',
    color: 'text-gray-500',
  },
};

export function PaymentCallback() {
  const hasProcessed = useRef(false);
  const [status, setStatus] = useState<PaymentStatus>('unknown');
  const [countdown, setCountdown] = useState(4);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const params = new URLSearchParams(window.location.search);
    const subscriptionStatus = (params.get('subscription_status') || 'unknown') as PaymentStatus;
    const validStatuses: PaymentStatus[] = ['authorized', 'pending', 'cancelled', 'paused'];
    setStatus(validStatuses.includes(subscriptionStatus) ? subscriptionStatus : 'unknown');

    // Build redirect URL preserving all params from MP
    const appBackUrl = params.get('back_url');
    if (appBackUrl) {
      try {
        const url = new URL(appBackUrl);
        params.forEach((v, k) => { if (k !== 'back_url') url.searchParams.set(k, v); });
        setRedirectUrl(url.toString());
      } catch {
        setRedirectUrl(null);
      }
    }
  }, []);

  useEffect(() => {
    if (!redirectUrl) return;
    if (countdown <= 0) {
      window.location.href = redirectUrl;
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, redirectUrl]);

  const config = STATUS_CONFIG[status];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-10 text-center">
        <div className="flex justify-center mb-5">
          {config.icon}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">{config.title}</h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-8">{config.message}</p>

        {redirectUrl ? (
          <>
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="relative w-12 h-12">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                  <circle
                    cx="24" cy="24" r="20" fill="none"
                    stroke="#2563eb" strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 20}`}
                    strokeDashoffset={`${2 * Math.PI * 20 * (countdown / 4)}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-blue-600">
                  {countdown}
                </span>
              </div>
              <span className="text-sm text-gray-500">Redirigiendo en {countdown}s</span>
            </div>

            <a
              href={redirectUrl}
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-6 py-2.5 rounded-lg transition-colors"
            >
              Continuar ahora
            </a>
          </>
        ) : (
          <div className="mt-2">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto" />
          </div>
        )}
      </div>
    </div>
  );
}
