import { CheckCircle, Loader2, XCircle } from 'lucide-react';

interface Step {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'success' | 'error';
}

interface AuthProgressProps {
  steps: Step[];
  currentStep: number;
  error?: string;
}

export function AuthProgress({ steps, currentStep, error }: AuthProgressProps) {
  const progress = ((currentStep + 1) / steps.length) * 100;
  const hasError = steps.some((step) => step.status === 'error');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {hasError ? 'Error de Autenticación' : 'Autenticando'}
            </h2>
            <p className="text-gray-600">
              {hasError
                ? 'Hubo un problema al procesar tu autenticación'
                : 'Por favor espera mientras procesamos tu información'}
            </p>
          </div>

          <div className="mb-8">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ease-out ${
                  hasError ? 'bg-red-500' : 'bg-blue-600'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 text-sm text-gray-600 text-right">
              {currentStep + 1} de {steps.length}
            </div>
          </div>

          <div className="space-y-4">
            {steps.map((step, index) => {
              const isActive = index === currentStep;
              const isPast = index < currentStep;
              const isFuture = index > currentStep;

              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-4 p-4 rounded-lg transition-all duration-300 ${
                    isActive
                      ? 'bg-blue-50 border-2 border-blue-200'
                      : isPast
                      ? 'bg-gray-50 border border-gray-200'
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {step.status === 'loading' && (
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    )}
                    {step.status === 'success' && (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    )}
                    {step.status === 'error' && (
                      <XCircle className="w-6 h-6 text-red-600" />
                    )}
                    {step.status === 'pending' && (
                      <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-500">
                          {index + 1}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <p
                      className={`font-medium ${
                        step.status === 'error'
                          ? 'text-red-900'
                          : isActive
                          ? 'text-blue-900'
                          : isPast
                          ? 'text-gray-700'
                          : 'text-gray-500'
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>

                  {isActive && step.status === 'loading' && (
                    <div className="flex-shrink-0">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {hasError && (
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Serás redirigido a la página de inicio en unos segundos...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
