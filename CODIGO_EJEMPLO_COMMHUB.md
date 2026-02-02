# 💻 Código de Ejemplo para CommHub

Código listo para integrar el sistema de licencias en CommHub.

## 📁 Estructura de Archivos

```
commhub/
├── src/
│   ├── services/
│   │   └── license.service.ts       # Servicio de licencias
│   ├── hooks/
│   │   └── useLicense.ts            # Hook de React
│   └── components/
│       ├── SubscriptionBanner.tsx   # Banner de prueba
│       ├── PaymentSuccess.tsx       # Página de confirmación
│       └── FeatureGuard.tsx         # Protección de features
└── .env
```

---

## 1. Configuración (.env)

```env
# URL de Supabase del sistema de licencias
VITE_LICENSE_API_URL=https://veymthufmfqhxxxzfmfi.supabase.co

# API Key de CommHub (obtenerla del Dashboard)
VITE_LICENSE_API_KEY=ak_your_api_key_here

# ID de la aplicación CommHub
VITE_APP_ID=commhub
```

---

## 2. Servicio de Licencias

```typescript
// src/services/license.service.ts

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  billing_cycle: string;
  mp_init_point: string;
  entitlements: {
    features: Record<string, any>;
  };
}

interface Subscription {
  id: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
  plan_name: string;
  period_start: string;
  period_end: string;
  trial_end?: string;
  mp_init_point?: string;
  entitlements?: {
    features: Array<{
      code: string;
      name: string;
      value: any;
    }>;
  };
}

interface ValidationResponse {
  success: boolean;
  has_access: boolean;
  tenant: {
    id: string;
    name: string;
    status: string;
  };
  subscription: Subscription | null;
  license: {
    license_key: string;
    expires_at: string;
  } | null;
  available_plans: Plan[];
  reason?: string;
}

class LicenseService {
  private baseUrl: string;
  private apiKey: string;
  private appId: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_LICENSE_API_URL;
    this.apiKey = import.meta.env.VITE_LICENSE_API_KEY;
    this.appId = import.meta.env.VITE_APP_ID;

    if (!this.baseUrl || !this.apiKey || !this.appId) {
      console.error('⚠️ License service not configured properly');
    }
  }

  /**
   * Valida el acceso de un usuario a CommHub
   */
  async validateUser(userEmail: string): Promise<ValidationResponse> {
    const response = await fetch(
      `${this.baseUrl}/functions/v1/validation-api/validate-user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({
          external_user_id: userEmail,
          external_app_id: this.appId,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`License validation failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Verifica si el usuario tiene acceso a una feature específica
   */
  async hasFeature(userEmail: string, featureCode: string): Promise<boolean> {
    try {
      const validation = await this.validateUser(userEmail);

      if (!validation.has_access || !validation.subscription) {
        return false;
      }

      const features = validation.subscription.entitlements?.features || [];
      const feature = features.find((f) => f.code === featureCode);

      return feature?.value === true || feature?.value === 'true';
    } catch (error) {
      console.error('Error checking feature:', error);
      return false;
    }
  }

  /**
   * Obtiene el límite de una feature
   */
  async getFeatureLimit(
    userEmail: string,
    featureCode: string
  ): Promise<number> {
    try {
      const validation = await this.validateUser(userEmail);

      if (!validation.has_access || !validation.subscription) {
        return 0;
      }

      const features = validation.subscription.entitlements?.features || [];
      const feature = features.find((f) => f.code === featureCode);

      return typeof feature?.value === 'number' ? feature.value : 0;
    } catch (error) {
      console.error('Error getting feature limit:', error);
      return 0;
    }
  }

  /**
   * Calcula los días restantes de una suscripción
   */
  calculateDaysRemaining(endDate: string): number {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Espera a que se confirme el pago (polling)
   */
  async waitForPaymentConfirmation(
    userEmail: string,
    maxAttempts: number = 15,
    intervalMs: number = 2000
  ): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const validation = await this.validateUser(userEmail);

        if (
          validation.has_access &&
          validation.subscription?.status === 'active'
        ) {
          return true;
        }
      } catch (error) {
        console.error(`Attempt ${i + 1} failed:`, error);
      }

      if (i < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    return false;
  }

  /**
   * Obtiene la URL para actualizar a un plan específico
   */
  getUpgradeUrl(plans: Plan[], planId: string): string | null {
    const plan = plans.find((p) => p.id === planId);
    return plan?.mp_init_point || null;
  }
}

export const licenseService = new LicenseService();
export type { ValidationResponse, Subscription, Plan };
```

---

## 3. Hook de React

```typescript
// src/hooks/useLicense.ts

import { useState, useEffect } from 'react';
import { licenseService, ValidationResponse } from '../services/license.service';

interface UseLicenseReturn {
  hasAccess: boolean;
  loading: boolean;
  error: string | null;
  subscription: ValidationResponse['subscription'];
  availablePlans: ValidationResponse['available_plans'];
  daysRemaining: number;
  isTrialing: boolean;
  isActive: boolean;
  refresh: () => Promise<void>;
}

export function useLicense(userEmail: string | null): UseLicenseReturn {
  const [data, setData] = useState<ValidationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLicense = async () => {
    if (!userEmail) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await licenseService.validateUser(userEmail);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLicense();
  }, [userEmail]);

  const daysRemaining = data?.subscription?.period_end
    ? licenseService.calculateDaysRemaining(data.subscription.period_end)
    : 0;

  return {
    hasAccess: data?.has_access || false,
    loading,
    error,
    subscription: data?.subscription || null,
    availablePlans: data?.available_plans || [],
    daysRemaining,
    isTrialing: data?.subscription?.status === 'trialing',
    isActive: data?.subscription?.status === 'active',
    refresh: fetchLicense,
  };
}

export function useFeature(userEmail: string | null, featureCode: string) {
  const [hasFeature, setHasFeature] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userEmail) {
      setLoading(false);
      return;
    }

    licenseService
      .hasFeature(userEmail, featureCode)
      .then(setHasFeature)
      .finally(() => setLoading(false));
  }, [userEmail, featureCode]);

  return { hasFeature, loading };
}
```

---

## 4. Banner de Suscripción

```tsx
// src/components/SubscriptionBanner.tsx

import { useLicense } from '../hooks/useLicense';
import { AlertTriangle } from 'lucide-react';

interface Props {
  userEmail: string;
}

export function SubscriptionBanner({ userEmail }: Props) {
  const { isTrialing, daysRemaining, subscription, loading } = useLicense(userEmail);

  if (loading) {
    return null;
  }

  if (!isTrialing || !subscription?.mp_init_point) {
    return null;
  }

  const isUrgent = daysRemaining <= 3;

  return (
    <div
      className={`border-l-4 p-4 ${
        isUrgent
          ? 'bg-red-50 border-red-400'
          : 'bg-yellow-50 border-yellow-400'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle
            className={isUrgent ? 'text-red-600' : 'text-yellow-600'}
            size={24}
          />
          <div>
            <p
              className={`font-medium ${
                isUrgent ? 'text-red-800' : 'text-yellow-800'
              }`}
            >
              Modo de Prueba: Te quedan{' '}
              <strong>{daysRemaining} días</strong> de prueba.
            </p>
            {isUrgent && (
              <p className="text-sm text-red-700 mt-1">
                ¡Tu periodo de prueba está por terminar!
              </p>
            )}
          </div>
        </div>
        <a
          href={subscription.mp_init_point}
          className={`px-4 py-2 rounded font-medium ${
            isUrgent
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-yellow-600 hover:bg-yellow-700 text-white'
          }`}
        >
          Actualizar Plan
        </a>
      </div>
    </div>
  );
}
```

---

## 5. Página de Confirmación de Pago

```tsx
// src/components/PaymentSuccess.tsx

import { useState, useEffect } from 'react';
import { licenseService } from '../services/license.service';
import { CheckCircle, Loader, XCircle } from 'lucide-react';

interface Props {
  userEmail: string;
  onSuccess?: () => void;
}

export function PaymentSuccess({ userEmail, onSuccess }: Props) {
  const [status, setStatus] = useState<'checking' | 'success' | 'failed'>('checking');

  useEffect(() => {
    async function verifyPayment() {
      const confirmed = await licenseService.waitForPaymentConfirmation(
        userEmail,
        15, // 15 intentos
        2000 // cada 2 segundos
      );

      if (confirmed) {
        setStatus('success');
        onSuccess?.();
      } else {
        setStatus('failed');
      }
    }

    verifyPayment();
  }, [userEmail, onSuccess]);

  if (status === 'checking') {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader className="animate-spin text-blue-600 mb-4" size={48} />
        <h2 className="text-xl font-semibold mb-2">Verificando tu pago...</h2>
        <p className="text-gray-600">
          Esto puede tomar unos segundos. Por favor espera.
        </p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <CheckCircle className="text-green-600 mb-4" size={64} />
        <h2 className="text-2xl font-bold mb-2">¡Pago Exitoso!</h2>
        <p className="text-gray-600 mb-6">
          Tu plan ha sido actualizado correctamente.
        </p>
        <button
          onClick={() => (window.location.href = '/dashboard')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
        >
          Ir al Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-12">
      <XCircle className="text-yellow-600 mb-4" size={64} />
      <h2 className="text-2xl font-bold mb-2">Procesando Pago</h2>
      <p className="text-gray-600 mb-6">
        Tu pago está siendo procesado. Recibirás una confirmación por email.
      </p>
      <button
        onClick={() => (window.location.href = '/dashboard')}
        className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium"
      >
        Volver al Dashboard
      </button>
    </div>
  );
}
```

---

## 6. Protección de Features

```tsx
// src/components/FeatureGuard.tsx

import { ReactNode } from 'react';
import { useFeature } from '../hooks/useLicense';
import { Lock } from 'lucide-react';

interface Props {
  userEmail: string;
  featureCode: string;
  children: ReactNode;
  fallback?: ReactNode;
  onUpgrade?: () => void;
}

export function FeatureGuard({
  userEmail,
  featureCode,
  children,
  fallback,
  onUpgrade,
}: Props) {
  const { hasFeature, loading } = useFeature(userEmail, featureCode);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!hasFeature) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <Lock className="mx-auto text-gray-400 mb-4" size={48} />
        <h3 className="text-lg font-semibold mb-2">
          Funcionalidad No Disponible
        </h3>
        <p className="text-gray-600 mb-4">
          Esta funcionalidad requiere un plan superior.
        </p>
        <button
          onClick={onUpgrade}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
        >
          Ver Planes
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

// Uso de ejemplo:
/*
<FeatureGuard
  userEmail={user.email}
  featureCode="advanced_analytics"
  onUpgrade={() => navigate('/plans')}
>
  <AdvancedAnalyticsDashboard />
</FeatureGuard>
*/
```

---

## 7. Ejemplo de Integración Completa

```tsx
// src/pages/Dashboard.tsx

import { useState, useEffect } from 'react';
import { SubscriptionBanner } from '../components/SubscriptionBanner';
import { FeatureGuard } from '../components/FeatureGuard';
import { useLicense } from '../hooks/useLicense';

export function Dashboard() {
  const user = useAuth(); // Tu hook de autenticación
  const { hasAccess, loading, subscription, daysRemaining } = useLicense(user?.email);

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (!hasAccess) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Acceso No Disponible</h2>
        <p className="text-gray-600 mb-6">
          Tu suscripción no está activa. Por favor contacta a soporte.
        </p>
        <button className="bg-blue-600 text-white px-6 py-2 rounded">
          Contactar Soporte
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner de suscripción */}
      <SubscriptionBanner userEmail={user.email} />

      <div className="container mx-auto p-6">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
          <p className="text-gray-600">
            Plan: <strong>{subscription?.plan_name}</strong>
          </p>
          {subscription?.status === 'trialing' && (
            <p className="text-yellow-600">
              Días restantes de prueba: <strong>{daysRemaining}</strong>
            </p>
          )}
        </div>

        {/* Contenido básico - siempre visible */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          <StatCard title="Enviados" value="589" />
          <StatCard title="Fallidos" value="43" />
          <StatCard title="Pendientes" value="48" />
        </div>

        {/* Feature protegida */}
        <FeatureGuard
          userEmail={user.email}
          featureCode="advanced_reports"
          onUpgrade={() => window.location.href = '/plans'}
        >
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Reportes Avanzados</h2>
            <AdvancedReportsComponent />
          </div>
        </FeatureGuard>
      </div>
    </div>
  );
}
```

---

## 8. Configuración de Rutas

```tsx
// src/App.tsx

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { PaymentSuccess } from './components/PaymentSuccess';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route
          path="/payment/success"
          element={
            <PaymentSuccess
              userEmail={user.email}
              onSuccess={() => {
                // Refrescar datos o redirigir
                window.location.href = '/dashboard';
              }}
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## 9. Configuración de mp_back_url

En el sistema de licencias, cuando crees los planes, configura el `mp_back_url` para que apunte a:

```
https://commhub.tudominio.com/payment/success
```

Esto asegura que después del pago, MercadoPago redirija al usuario a la página de confirmación de CommHub.

---

## 10. Testing

```typescript
// src/services/license.service.test.ts

describe('LicenseService', () => {
  it('should validate user successfully', async () => {
    const result = await licenseService.validateUser('test@example.com');
    expect(result.success).toBe(true);
  });

  it('should check feature access', async () => {
    const hasFeature = await licenseService.hasFeature(
      'test@example.com',
      'advanced_reports'
    );
    expect(typeof hasFeature).toBe('boolean');
  });

  it('should wait for payment confirmation', async () => {
    const confirmed = await licenseService.waitForPaymentConfirmation(
      'test@example.com',
      3,
      1000
    );
    expect(typeof confirmed).toBe('boolean');
  });
});
```

---

## Resumen de la Integración

1. ✅ Copiar archivos de servicio y hooks
2. ✅ Configurar variables de entorno
3. ✅ Agregar el banner de suscripción
4. ✅ Configurar página de confirmación de pago
5. ✅ Proteger features con FeatureGuard
6. ✅ Todo el resto es automático vía webhooks

El sistema actualiza automáticamente las licencias cuando el usuario paga en MercadoPago.
