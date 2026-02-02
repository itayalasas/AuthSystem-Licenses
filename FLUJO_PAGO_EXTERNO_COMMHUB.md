# 🔄 Flujo de Pago Externo desde CommHub

Esta guía explica cómo funciona el sistema de pagos cuando un usuario activa/actualiza su plan desde CommHub (u otra aplicación externa) usando MercadoPago.

## 📋 Índice

1. [Visión General](#visión-general)
2. [Configuración Inicial](#configuración-inicial)
3. [Flujo Completo](#flujo-completo)
4. [Integración en CommHub](#integración-en-commhub)
5. [Verificación Post-Pago](#verificación-post-pago)
6. [Troubleshooting](#troubleshooting)

---

## Visión General

### ¿Cómo Funciona?

Cuando un usuario de CommHub hace clic en "Actualizar Plan":

1. **CommHub** redirige al usuario a MercadoPago
2. El usuario completa el pago en MercadoPago
3. **MercadoPago** envía un webhook al sistema de licencias
4. El sistema **actualiza automáticamente**:
   - ✅ La suscripción del usuario
   - ✅ La licencia en la tabla `licenses`
   - ✅ El registro de pago
5. **CommHub** verifica el estado actualizado y muestra el nuevo plan

### Arquitectura

```
CommHub → MercadoPago → Webhook → Sistema de Licencias
   ↓                                        ↓
Usuario                              Actualización
   ↓                                   Automática
Valida ← API de Validación ← Estado Actualizado
```

---

## Configuración Inicial

### 1. Registrar CommHub como Aplicación

Primero debes tener CommHub registrado en el sistema:

```sql
-- Verificar que CommHub existe
SELECT * FROM applications WHERE external_app_id = 'commhub';
```

Si no existe, créalo desde el Dashboard o usando la Admin API.

### 2. Crear Planes con MercadoPago

Cada plan debe tener configurado su link de MercadoPago:

```sql
-- Ejemplo de plan configurado
SELECT
  id,
  name,
  mp_preapproval_plan_id,  -- ID del plan en MercadoPago
  mp_init_point,            -- URL de pago
  mp_back_url              -- URL de retorno
FROM plans
WHERE application_id = (SELECT id FROM applications WHERE external_app_id = 'commhub');
```

### 3. Configurar Webhook en MercadoPago

En tu cuenta de MercadoPago:

1. Ve a **Configuración → Webhooks**
2. Agrega esta URL:
   ```
   https://TU_SUPABASE_URL/functions/v1/webhook-handler/mercadopago
   ```
3. Selecciona estos eventos:
   - ✅ `payment.created`
   - ✅ `payment.approved`
   - ✅ `preapproval` (suscripciones)

### 4. Vincular Usuario de CommHub

Cuando un usuario se registra en CommHub, debes crear su registro:

```javascript
// En CommHub - Al registrar usuario
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/admin-api/application-users`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      application_id: 'commhub',  // o el UUID de la aplicación
      external_user_id: user.email,  // Usar el email como ID
      user_email: user.email,
      user_metadata: {
        name: user.name,
        commhub_user_id: user.id
      }
    })
  }
);
```

---

## Flujo Completo

### Paso 1: Usuario en CommHub ve el Banner

```javascript
// CommHub - Componente de Banner
function SubscriptionBanner({ user }) {
  const [subscriptionData, setSubscriptionData] = useState(null);

  useEffect(() => {
    // Validar estado actual
    fetch(`${SUPABASE_URL}/functions/v1/validation-api/validate-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': COMMHUB_API_KEY
      },
      body: JSON.stringify({
        external_user_id: user.email,
        external_app_id: 'commhub'
      })
    })
    .then(res => res.json())
    .then(data => {
      setSubscriptionData(data);
    });
  }, [user]);

  if (!subscriptionData?.has_access) {
    return (
      <div className="trial-banner">
        <p>Modo de Prueba: Te quedan {subscriptionData?.trial_days_remaining} días</p>
        <button onClick={() => window.location.href = subscriptionData?.subscription?.mp_init_point}>
          Actualizar Plan
        </button>
      </div>
    );
  }

  return null;
}
```

### Paso 2: Usuario Hace Clic en "Actualizar Plan"

CommHub redirige al `mp_init_point` que viene de la API de validación:

```javascript
// El mp_init_point es algo como:
// https://www.mercadopago.com.uy/subscriptions/checkout?preapproval_plan_id=PLAN_ID
```

### Paso 3: Usuario Completa el Pago

El usuario es redirigido a MercadoPago donde:
1. Ingresa sus datos de pago
2. Confirma la suscripción
3. MercadoPago lo redirige al `mp_back_url` configurado

### Paso 4: MercadoPago Envía Webhook (Automático)

MercadoPago envía una notificación al webhook:

```json
{
  "type": "payment.approved",
  "data": {
    "id": "123456789",
    "transaction_amount": 990,
    "payer": {
      "id": "12345",
      "email": "usuario@ejemplo.com"
    },
    "preapproval_id": "abc123xyz"
  }
}
```

### Paso 5: Sistema Procesa el Webhook (Automático)

El webhook hace lo siguiente automáticamente:

1. **Busca el pago pendiente** (si existe)
2. **Marca el pago como completado**
3. **Actualiza la suscripción** a estado `active`
4. **Actualiza o crea la licencia**:
   ```javascript
   // Código del webhook (ya implementado)
   async function updateOrCreateLicense(supabase, subscriptionId) {
     const subscription = await getSubscription(subscriptionId);

     const existingLicense = await findLicense(subscriptionId);

     if (existingLicense) {
       // Actualizar licencia existente
       await supabase.from('licenses').update({
         status: 'active',
         expires_at: subscription.period_end,
         entitlements: subscription.plan.entitlements,
         type: 'paid'
       }).eq('id', existingLicense.id);
     } else {
       // Crear nueva licencia
       await supabase.from('licenses').insert({
         tenant_id: subscription.tenant_id,
         subscription_id: subscriptionId,
         application_id: subscription.plan.application_id,
         plan_id: subscription.plan_id,
         status: 'active',
         type: 'paid',
         expires_at: subscription.period_end,
         entitlements: subscription.plan.entitlements
       });
     }
   }
   ```

### Paso 6: CommHub Verifica el Estado Actualizado

Después de que el usuario regresa de MercadoPago:

```javascript
// CommHub - Página de retorno después del pago
function PaymentSuccess() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    // Esperar un momento para que el webhook se procese
    setTimeout(async () => {
      const result = await fetch(
        `${SUPABASE_URL}/functions/v1/validation-api/validate-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': COMMHUB_API_KEY
          },
          body: JSON.stringify({
            external_user_id: user.email,
            external_app_id: 'commhub'
          })
        }
      ).then(r => r.json());

      if (result.has_access && result.subscription?.status === 'active') {
        setStatus('success');
        // Actualizar UI de CommHub
        updateUserPlanInUI(result.subscription.plan);
      } else {
        setStatus('pending');
        // Mostrar que está procesando
      }
    }, 3000); // Esperar 3 segundos
  }, []);

  if (status === 'checking') {
    return <div>Verificando tu pago...</div>;
  }

  if (status === 'success') {
    return (
      <div className="success-message">
        <h2>¡Pago Exitoso!</h2>
        <p>Tu plan ha sido actualizado correctamente.</p>
        <button onClick={() => window.location.href = '/dashboard'}>
          Ir al Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="pending-message">
      <p>Estamos procesando tu pago. Esto puede tomar unos minutos.</p>
    </div>
  );
}
```

---

## Integración en CommHub

### Código Completo de Ejemplo

```typescript
// commhub/src/services/license-service.ts

interface SubscriptionStatus {
  has_access: boolean;
  subscription: {
    status: string;
    plan_name: string;
    period_end: string;
    mp_init_point?: string;
  };
  available_plans: Array<{
    id: string;
    name: string;
    price: number;
    mp_init_point: string;
  }>;
}

class LicenseService {
  private apiUrl: string;
  private apiKey: string;
  private appId: string;

  constructor() {
    this.apiUrl = import.meta.env.VITE_SUPABASE_URL;
    this.apiKey = import.meta.env.VITE_COMMHUB_API_KEY;
    this.appId = 'commhub';
  }

  async getSubscriptionStatus(userEmail: string): Promise<SubscriptionStatus> {
    const response = await fetch(
      `${this.apiUrl}/functions/v1/validation-api/validate-user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          external_user_id: userEmail,
          external_app_id: this.appId
        })
      }
    );

    if (!response.ok) {
      throw new Error('Failed to validate subscription');
    }

    return response.json();
  }

  async checkFeatureAccess(userEmail: string, featureCode: string): Promise<boolean> {
    const status = await this.getSubscriptionStatus(userEmail);

    if (!status.has_access) {
      return false;
    }

    const features = status.subscription?.plan?.entitlements?.features || {};
    return features[featureCode] === true;
  }

  getUpgradeUrl(planId: string, plans: any[]): string {
    const plan = plans.find(p => p.id === planId);
    return plan?.mp_init_point || '';
  }

  async waitForPaymentConfirmation(
    userEmail: string,
    maxAttempts = 10
  ): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2s

      const status = await this.getSubscriptionStatus(userEmail);

      if (status.has_access && status.subscription.status === 'active') {
        return true;
      }
    }

    return false;
  }
}

export const licenseService = new LicenseService();
```

### Uso en Componentes

```tsx
// CommHub - Banner de Suscripción
import { licenseService } from '@/services/license-service';

export function SubscriptionBanner({ user }: { user: User }) {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    licenseService.getSubscriptionStatus(user.email)
      .then(setStatus)
      .finally(() => setLoading(false));
  }, [user.email]);

  if (loading) return <div>Cargando...</div>;

  if (!status?.has_access || status.subscription.status === 'trialing') {
    const daysLeft = calculateDaysLeft(status?.subscription?.period_end);

    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-yellow-700">
              Modo de Prueba: Te quedan <strong>{daysLeft} días</strong> de prueba.
            </p>
          </div>
          <a
            href={status?.subscription?.mp_init_point}
            className="btn btn-primary"
          >
            Actualizar Plan
          </a>
        </div>
      </div>
    );
  }

  return null;
}

// CommHub - Página de Confirmación de Pago
export function PaymentConfirmation({ user }: { user: User }) {
  const [confirmed, setConfirmed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    licenseService.waitForPaymentConfirmation(user.email)
      .then(success => {
        setConfirmed(success);
        setChecking(false);
      });
  }, [user.email]);

  if (checking) {
    return (
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4">Verificando tu pago...</p>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="text-center p-8">
        <div className="text-green-600 text-6xl mb-4">✓</div>
        <h2 className="text-2xl font-bold mb-2">¡Pago Exitoso!</h2>
        <p className="text-gray-600 mb-6">
          Tu plan ha sido actualizado correctamente.
        </p>
        <button
          onClick={() => window.location.href = '/dashboard'}
          className="btn btn-primary"
        >
          Ir al Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="text-center p-8">
      <p>El pago está siendo procesado. Por favor espera...</p>
    </div>
  );
}

// CommHub - Protección de Features
export function AdvancedFeature({ user, featureCode }: Props) {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    licenseService.checkFeatureAccess(user.email, featureCode)
      .then(setHasAccess)
      .finally(() => setLoading(false));
  }, [user.email, featureCode]);

  if (loading) return <div>Cargando...</div>;

  if (!hasAccess) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">
          Funcionalidad No Disponible
        </h3>
        <p className="text-gray-600 mb-4">
          Esta funcionalidad requiere un plan superior.
        </p>
        <button
          onClick={() => {/* Mostrar planes */}}
          className="btn btn-primary"
        >
          Ver Planes
        </button>
      </div>
    );
  }

  return <YourAdvancedFeatureComponent />;
}
```

---

## Verificación Post-Pago

### Polling vs Webhook

**Opción 1: Polling (Recomendada para CommHub)**

CommHub verifica el estado cada 2-3 segundos después del pago:

```javascript
async function checkPaymentStatus(userEmail, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await validateUser(userEmail);

    if (status.has_access && status.subscription.status === 'active') {
      return { success: true, subscription: status.subscription };
    }

    await sleep(2000); // Esperar 2 segundos
  }

  return { success: false, message: 'Timeout verificando pago' };
}
```

**Opción 2: Webhook Propio (Opcional)**

Si CommHub tiene su propio backend, puede recibir notificaciones:

```javascript
// En el sistema de licencias, después de procesar el pago
async function notifyApplication(subscription) {
  const app = await getApplication(subscription.application_id);

  if (app.webhook_url) {
    await fetch(app.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'subscription.updated',
        subscription_id: subscription.id,
        tenant_id: subscription.tenant_id,
        status: subscription.status,
        plan: subscription.plan
      })
    });
  }
}
```

---

## Troubleshooting

### El pago se procesó pero CommHub no se actualiza

**Causa:** El webhook puede tardar unos segundos

**Solución:**
1. Esperar 5-10 segundos antes de verificar
2. Implementar polling con reintentos
3. Verificar en los logs del webhook si llegó la notificación

```javascript
// Verificar logs
SELECT * FROM subscription_payments
WHERE provider_transaction_id = 'MP-123456'
ORDER BY created_at DESC;
```

### Usuario reporta que pagó pero sigue en trial

**Diagnóstico:**

```sql
-- 1. Verificar que existe el application_user
SELECT * FROM application_users
WHERE external_user_id = 'usuario@ejemplo.com'
AND application_id = (SELECT id FROM applications WHERE external_app_id = 'commhub');

-- 2. Verificar la suscripción
SELECT s.*, p.name as plan_name
FROM subscriptions s
JOIN plans p ON s.plan_id = p.id
WHERE s.tenant_id IN (
  SELECT tenant_id FROM application_users
  WHERE external_user_id = 'usuario@ejemplo.com'
);

-- 3. Verificar pagos
SELECT * FROM subscription_payments
WHERE tenant_id IN (
  SELECT tenant_id FROM application_users
  WHERE external_user_id = 'usuario@ejemplo.com'
)
ORDER BY created_at DESC;

-- 4. Verificar licencia
SELECT * FROM licenses
WHERE tenant_id IN (
  SELECT tenant_id FROM application_users
  WHERE external_user_id = 'usuario@ejemplo.com'
);
```

### El webhook no está recibiendo notificaciones

**Verificar:**
1. URL del webhook en MercadoPago
2. Que la Edge Function esté desplegada
3. Los logs de Supabase:
   ```bash
   # Ver logs en tiempo real
   supabase functions logs webhook-handler --follow
   ```

### Diferentes usuarios usan el mismo email

**Solución:** Usar un identificador único en lugar del email:

```javascript
// En lugar de usar email
external_user_id: user.email

// Usar un ID único
external_user_id: `commhub_${user.id}`
```

---

## Resumen del Flujo

```
1. Usuario en CommHub ve: "Modo de Prueba - 7 días restantes [Actualizar Plan]"
   ↓
2. Click en "Actualizar Plan" → Redirige a mp_init_point
   ↓
3. Usuario completa pago en MercadoPago
   ↓
4. MercadoPago envía webhook automático
   ↓
5. Sistema actualiza:
   - ✅ subscription.status = 'active'
   - ✅ subscription_payments.status = 'completed'
   - ✅ licenses.status = 'active'
   - ✅ licenses.expires_at = periodo extendido
   ↓
6. Usuario regresa a CommHub (mp_back_url)
   ↓
7. CommHub verifica estado (polling cada 2s)
   ↓
8. CommHub muestra: "✓ Plan actualizado - Plan Pro activo"
```

Todo el proceso es **100% automático** después de la configuración inicial.
