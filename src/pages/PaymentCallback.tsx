import { useEffect, useRef, useState } from 'react';
import { CheckCircle, Clock, XCircle, PauseCircle, Loader2, AlertCircle } from 'lucide-react';
import { ConfigService } from '../lib/config';

type PaymentStatus = 'authorized' | 'pending' | 'cancelled' | 'paused' | 'loading' | 'error';

const STATUS_CONFIG: Record<PaymentStatus, {
  icon: React.ReactNode;
  title: string;
  message: string;
  color: string;
}> = {
  loading: {
    icon: <Loader2 className="w-14 h-14 text-blue-500 animate-spin" />,
    title: 'Confirmando suscripción',
    message: 'Estamos verificando el estado de tu pago con MercadoPago...',
    color: 'text-blue-600',
  },
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
  error: {
    icon: <AlertCircle className="w-14 h-14 text-red-400" />,
    title: 'Error al confirmar',
    message: 'No pudimos verificar el estado de tu pago. Podés cerrar esta ventana e intentar nuevamente.',
    color: 'text-red-500',
  },
};

export function PaymentCallback() {
  const hasProcessed = useRef(false);
  const [status, setStatus] = useState<PaymentStatus>('loading');
  const [countdown, setCountdown] = useState(4);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const params = new URLSearchParams(window.location.search);

    // If the edge function already resolved everything (has subscription_status param),
    // use those params directly — no need to call confirm-subscription again.
    const alreadyResolved = params.get('subscription_status');
    if (alreadyResolved) {
      const validStatuses: PaymentStatus[] = ['authorized', 'pending', 'cancelled', 'paused'];
      const resolvedStatus = validStatuses.includes(alreadyResolved as PaymentStatus)
        ? (alreadyResolved as PaymentStatus)
        : 'pending';
      setStatus(resolvedStatus);
      const planNameParam = params.get('plan_name');
      if (planNameParam) setPlanName(planNameParam);
      const backUrl = params.get('back_url');
      if (backUrl) {
        buildRedirectUrl(backUrl, params, {
          subscription_status: alreadyResolved,
          subscription_id: params.get('subscription_id'),
          plan_id: params.get('plan_id'),
          plan_name: planNameParam,
          preapproval_id: params.get('preapproval_id'),
        });
      }
      return;
    }

    // Extract preapproval_id — MP can embed it inside app_id if our back_url already had ?app_id=
    let preapprovalId = params.get('preapproval_id');
    const rawAppId = params.get('app_id') ?? '';
    if (!preapprovalId && rawAppId.includes('?')) {
      const embedded = new URLSearchParams(rawAppId.split('?')[1]);
      preapprovalId = embedded.get('preapproval_id');
    }

    if (!preapprovalId) {
      setStatus('error');
      setErrorDetail('No se recibió el identificador de suscripción de MercadoPago.');
      return;
    }

    // Load config first (uses get-env API), then call confirm-subscription
    ConfigService.getConfig()
      .then(() => confirmSubscription(preapprovalId!, params))
      .catch(() => confirmSubscription(preapprovalId!, params));
  }, []);

  async function confirmSubscription(preapprovalId: string, originalParams: URLSearchParams) {
    try {
      const supabaseUrl = ConfigService.getVariable('VITE_SUPABASE_URL')
        || ConfigService.getVariable('SUPABASE_URL');
      const supabaseAnonKey = ConfigService.getVariable('VITE_SUPABASE_ANON_KEY')
        || ConfigService.getVariable('SUPABASE_ANON_KEY');

      if (!supabaseUrl) {
        setStatus('error');
        setErrorDetail('No se pudo obtener la configuración del sistema.');
        return;
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/confirm-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey ?? ''}`,
        },
        body: JSON.stringify({ preapproval_id: preapprovalId }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        console.error('confirm-subscription error:', data);
        setStatus('error');
        setErrorDetail(data.error || 'Error desconocido');
        return;
      }

      const mpStatus = data.mp_status as string;
      const validStatuses: PaymentStatus[] = ['authorized', 'pending', 'cancelled', 'paused'];
      const resolvedStatus = validStatuses.includes(mpStatus as PaymentStatus)
        ? (mpStatus as PaymentStatus)
        : 'pending';

      setStatus(resolvedStatus);
      if (data.plan_name) setPlanName(data.plan_name);

      if (data.back_url) {
        buildRedirectUrl(data.back_url, originalParams, {
          subscription_status: mpStatus,
          subscription_id: data.subscription_id,
          plan_id: data.plan_id,
          plan_name: data.plan_name,
        });
      }
    } catch (err) {
      console.error('confirm-subscription fetch error:', err);
      setStatus('error');
      setErrorDetail('Error de conexión al verificar el pago.');
    }
  }

  // Params that belong only to the admin panel callback — not forwarded to the app
  const INTERNAL_PARAMS = new Set(['back_url', 'app_id']);

  function buildRedirectUrl(
    backUrl: string,
    params: URLSearchParams,
    extra: Record<string, string | null> = {}
  ) {
    // Avoid double-decoding: only decode if the string contains %
    const rawUrl = backUrl.includes('%') ? decodeURIComponent(backUrl) : backUrl;
    try {
      const url = new URL(rawUrl);
      // Merge extra values (explicit wins over params)
      const merged: Record<string, string> = {};
      params.forEach((v, k) => { if (!INTERNAL_PARAMS.has(k)) merged[k] = v; });
      Object.entries(extra).forEach(([k, v]) => { if (v != null) merged[k] = v; });
      Object.entries(merged).forEach(([k, v]) => url.searchParams.set(k, v));
      setRedirectUrl(url.toString());
    } catch {
      const sep = rawUrl.includes('?') ? '&' : '?';
      const merged: Record<string, string> = {};
      params.forEach((v, k) => { if (!INTERNAL_PARAMS.has(k)) merged[k] = v; });
      Object.entries(extra).forEach(([k, v]) => { if (v != null) merged[k] = v; });
      const qs = Object.entries(merged)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      setRedirectUrl(qs ? `${rawUrl}${sep}${qs}` : rawUrl);
    }
  }

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
        {planName && status === 'authorized' && (
          <p className="text-sm font-medium text-green-700 bg-green-50 rounded-lg px-3 py-1.5 inline-block mb-3">
            Plan {planName}
          </p>
        )}
        <p className="text-gray-500 text-sm leading-relaxed mb-8">{config.message}</p>

        {status === 'loading' && (
          <div className="flex justify-center gap-1.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        )}

        {status === 'error' && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-4">
            {errorDetail || config.message}
          </div>
        )}

        {redirectUrl && status !== 'loading' && (
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
        )}

        {!redirectUrl && status !== 'loading' && status !== 'error' && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-4">
            No hay URL de retorno configurada para esta aplicación. Configura el campo
            <strong> "URL de retorno tras pago"</strong> en la configuración de la aplicación.
          </div>
        )}
      </div>
    </div>
  );
}
