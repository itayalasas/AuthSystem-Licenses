import { useEffect, useState } from 'react';
import { ConfigService } from '../lib/config';
import { initializeSupabase } from '../lib/supabase';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface ConfigLoaderProps {
  children: React.ReactNode;
}

export function ConfigLoader({ children }: ConfigLoaderProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    loadConfig();
  }, [retryCount]);

  async function loadConfig() {
    try {
      setStatus('loading');
      setError(null);

      await ConfigService.initialize();
      await initializeSupabase();

      setStatus('success');
    } catch (err) {
      console.error('Failed to load configuration:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');

      if (ConfigService.isConfigured()) {
        console.log('Using cached configuration');
        setStatus('success');
      } else {
        setStatus('error');
      }
    }
  }

  function handleRetry() {
    setRetryCount((prev) => prev + 1);
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Cargando configuración
            </h2>
            <p className="text-gray-600 mb-6">Por favor espera un momento</p>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 animate-pulse w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Error de Configuración
          </h2>
          <p className="text-gray-600 mb-6">
            No se pudo cargar la configuración de la aplicación.
          </p>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-800 font-mono">{error}</p>
            </div>
          )}
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors mx-auto"
          >
            <RefreshCw className="w-5 h-5" />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
