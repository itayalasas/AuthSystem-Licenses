import { Loader2 } from 'lucide-react';

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

  // Solo mostrar pasos hasta el actual + 1
  const visibleSteps = steps.slice(0, Math.min(currentStep + 2, steps.length));
  const currentStepData = steps[currentStep];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="mb-4">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {hasError ? 'Error de Autenticación' : 'Cargando'}
            </h2>
            <p className="text-gray-600">
              {hasError
                ? 'Hubo un problema al procesar tu autenticación'
                : currentStepData?.label || 'Procesando...'}
            </p>
          </div>

          <div className="mb-6">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ease-out ${
                  hasError ? 'bg-red-500' : 'bg-blue-600'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="space-y-2 text-sm">
            {visibleSteps.map((step, index) => {
              const isActive = index === currentStep;
              const isPast = index < currentStep;

              if (step.status === 'pending' && !isActive) return null;

              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 py-2 transition-all duration-300 ${
                    isActive ? 'opacity-100' : isPast ? 'opacity-60' : 'opacity-40'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {step.status === 'loading' && isActive && (
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></span>
                      </div>
                    )}
                    {step.status === 'success' && (
                      <svg
                        className="w-4 h-4 text-green-600"
                        fill="none"
                        strokeWidth="2"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {step.status === 'error' && (
                      <svg
                        className="w-4 h-4 text-red-600"
                        fill="none"
                        strokeWidth="2"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>

                  <p
                    className={`text-sm ${
                      step.status === 'error'
                        ? 'text-red-900 font-medium'
                        : isActive
                        ? 'text-gray-900 font-medium'
                        : 'text-gray-600'
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>

          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
