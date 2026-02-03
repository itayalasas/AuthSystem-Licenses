# Guía de Pagos Recurrentes

Esta guía explica cómo funciona el sistema de pagos recurrentes automáticos implementado con MercadoPago.

## Flujo Completo

### 1. Usuario se registra y obtiene un trial

Cuando un usuario se registra en tu aplicación:

```javascript
// Tu aplicación hace la llamada a validation-api
const response = await fetch(`${SUPABASE_URL}/functions/v1/validation-api/validate-user`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  },
  body: JSON.stringify({
    external_user_id: 'user123',
    external_app_id: 'APP_001',
    user_email: 'usuario@ejemplo.com',
  }),
});

const data = await response.json();
// El usuario recibe una licencia de trial automáticamente
// data.license.type === 'trial'
// data.license.expires_at contiene la fecha de expiración
```

### 2. Usuario registra su método de pago

Durante el período de trial (o después de que expire), el usuario debe registrar su método de pago:

```javascript
// Verificar si el usuario ya tiene método de pago registrado
const statusResponse = await fetch(
  `${SUPABASE_URL}/functions/v1/recurring-subscriptions/subscription-status?external_user_id=user123&external_app_id=APP_001`,
  {
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
  }
);

const status = await statusResponse.json();
if (!status.has_payment_method) {
  // Mostrar modal o banner para registrar método de pago
}
```

Para registrar el método de pago:

```javascript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/recurring-subscriptions/create-subscription`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      external_user_id: 'user123',
      external_app_id: 'APP_001',
      payer_email: 'usuario@ejemplo.com',
    }),
  }
);

const data = await response.json();
if (data.success) {
  // Redirigir al usuario a MercadoPago
  window.location.href = data.data.checkout_url;
}
```

### 3. Usuario completa el registro en MercadoPago

El usuario es redirigido a MercadoPago donde:
- Ingresa los datos de su tarjeta
- Acepta los términos de cobro recurrente
- MercadoPago crea un "preapproval" (suscripción)

Cuando el usuario completa el proceso:
- MercadoPago envía un webhook a tu sistema
- El webhook actualiza la suscripción con el `provider_subscription_id`
- El usuario es redirigido a tu `MERCADOPAGO_BACK_URL`

### 4. Transición automática de trial a pago

El sistema incluye un cron job que se ejecuta diariamente:

```bash
# URL del cron job
POST https://tu-proyecto.supabase.co/functions/v1/process-trial-transitions
```

Este cron job:

1. Busca todas las suscripciones en estado `trialing` donde `trial_end` ha pasado
2. Para cada suscripción:
   - **Si tiene método de pago registrado**:
     - Cambia el estado a `active`
     - Extiende el `period_end` según el ciclo de facturación
     - MercadoPago cobrará automáticamente en la fecha correspondiente
   - **Si NO tiene método de pago**:
     - Cambia el estado a `past_due`
     - Marca la licencia como `expired`
     - El usuario pierde acceso hasta que registre su pago

### 5. Cobros recurrentes automáticos

Una vez que el trial se convierte a pago:

- MercadoPago cobra automáticamente según el ciclo configurado (mensual o anual)
- Cada cobro exitoso envía un webhook `payment.approved`
- El webhook:
  - Crea un registro en `subscription_payments`
  - Actualiza la suscripción extendiendo el `period_end`
  - Actualiza la licencia con la nueva fecha de expiración

## Integración en tu aplicación

### Componentes React incluidos

El sistema incluye componentes React listos para usar:

#### 1. Hook `usePaymentStatus`

```typescript
import { usePaymentStatus } from './hooks/usePaymentStatus';

function MyApp() {
  const paymentStatus = usePaymentStatus(externalUserId, externalAppId);

  if (paymentStatus.loading) {
    return <div>Cargando...</div>;
  }

  if (!paymentStatus.hasPaymentMethod && paymentStatus.subscription?.days_until_trial_end <= 7) {
    // Mostrar advertencia
  }
}
```

#### 2. Componente `PaymentWarningBanner`

```typescript
import { PaymentWarningBanner } from './components/PaymentWarningBanner';

function Dashboard() {
  const paymentStatus = usePaymentStatus(userId, appId);

  return (
    <div>
      {!paymentStatus.hasPaymentMethod && paymentStatus.subscription && (
        <PaymentWarningBanner
          externalUserId={userId}
          externalAppId={appId}
          userEmail={userEmail}
          planName={paymentStatus.subscription.plan_name}
          trialEndDate={paymentStatus.subscription.trial_end}
          daysUntilTrialEnd={paymentStatus.subscription.days_until_trial_end}
          onPaymentRegistered={() => {
            // Recargar el estado
            window.location.reload();
          }}
        />
      )}

      {/* Resto de tu dashboard */}
    </div>
  );
}
```

#### 3. Modal `RegisterPaymentModal`

```typescript
import { RegisterPaymentModal } from './components/RegisterPaymentModal';

function MyComponent() {
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  return (
    <>
      <button onClick={() => setShowPaymentModal(true)}>
        Registrar Método de Pago
      </button>

      <RegisterPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        externalUserId={userId}
        externalAppId={appId}
        userEmail={userEmail}
        planName={planName}
        trialEndDate={trialEndDate}
        onSuccess={() => {
          setShowPaymentModal(false);
          // Actualizar estado
        }}
      />
    </>
  );
}
```

## Configuración del Cron Job

### Opción 1: Netlify Functions (Recomendado)

Si tu frontend está en Netlify, puedes usar Netlify Scheduled Functions:

1. Crea el archivo `netlify/functions/process-trials.ts`:

```typescript
import { schedule } from '@netlify/functions';

const handler = schedule('0 0 * * *', async () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(
    `${supabaseUrl}/functions/v1/process-trial-transitions`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
      },
    }
  );

  const result = await response.json();
  console.log('Trial transitions processed:', result);

  return {
    statusCode: 200,
  };
});

export { handler };
```

### Opción 2: Servicio externo (Cron-job.org, EasyCron, etc.)

1. Registrate en [cron-job.org](https://cron-job.org)
2. Crea un nuevo cron job:
   - URL: `https://tu-proyecto.supabase.co/functions/v1/process-trial-transitions`
   - Método: POST
   - Header: `Authorization: Bearer TU_SUPABASE_ANON_KEY`
   - Frecuencia: Diariamente a las 00:00

### Opción 3: GitHub Actions

Crea `.github/workflows/process-trials.yml`:

```yaml
name: Process Trial Transitions

on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

jobs:
  process-trials:
    runs-on: ubuntu-latest
    steps:
      - name: Process trials
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            https://tu-proyecto.supabase.co/functions/v1/process-trial-transitions
```

## Webhooks de MercadoPago

### Configuración

1. Ve a tu cuenta de MercadoPago
2. Navega a **Desarrolladores → Webhooks**
3. Agrega la URL: `https://tu-proyecto.supabase.co/functions/v1/webhook-handler/mercadopago`

### Eventos procesados

El sistema procesa automáticamente estos eventos:

- `subscription_preapproval` / `preapproval`: Cuando el usuario completa el registro
- `payment.created` / `payment.approved`: Cuando MercadoPago cobra exitosamente
- `payment.failed` / `payment.rejected`: Cuando el pago falla
- `preapproval.cancelled` / `preapproval.paused`: Cuando se cancela la suscripción

## Estados de suscripción

| Estado | Descripción | Acción |
|--------|-------------|--------|
| `trialing` | Usuario en período de prueba | Mostrar advertencia días antes del fin |
| `active` | Suscripción activa y pagando | Todo funcional |
| `past_due` | Trial expiró sin método de pago | Bloquear acceso, solicitar pago |
| `canceled` | Usuario canceló la suscripción | Acceso hasta fin del período pagado |
| `paused` | Suscripción pausada | Similar a canceled |

## Monitoreo y logs

Para ver los logs de procesamiento:

1. **Logs de edge functions**: Ve a Supabase Dashboard → Edge Functions → Logs
2. **Filtrar por función**: Selecciona `process-trial-transitions` o `webhook-handler`
3. **Buscar errores**: Los errores aparecen con el emoji ❌

Ejemplo de logs exitosos:

```
🔄 Starting trial transition processing...
📊 Found 3 expiring trials
🔍 Processing subscription abc-123 for tenant Example Corp
✅ Subscription has payment method (mercadopago): def-456
✅ Subscription converted to paid, will be charged by mercadopago
📈 Processing complete: ✅ Processed: 3, ❌ Failed: 0
```

## Preguntas frecuentes

### ¿Qué pasa si el usuario no registra su método de pago?

El sistema marca la suscripción como `past_due` y la licencia como `expired`. El usuario pierde acceso hasta que registre su pago.

### ¿Cómo manejo los pagos fallidos?

MercadoPago reintenta automáticamente. Si el pago falla, recibirás un webhook `payment.failed` y puedes notificar al usuario.

### ¿Puedo cambiar el plan de un usuario?

Sí, usa el endpoint `/users/assign-plan` del admin-api para cambiar el plan. MercadoPago seguirá cobrando el nuevo monto.

### ¿Cómo cancelo una suscripción?

El usuario debe cancelar desde su cuenta de MercadoPago. Esto enviará un webhook que actualizará el estado automáticamente.

### ¿Los cobros son exactamente el mismo día cada mes?

MercadoPago maneja la lógica de fechas. Para suscripciones mensuales, cobra aproximadamente el mismo día cada mes.

## Troubleshooting

### El cron job no se ejecuta

- Verifica que el endpoint responde: `curl -X POST https://tu-proyecto.supabase.co/functions/v1/process-trial-transitions`
- Revisa los logs de tu servicio de cron
- Confirma que los headers de autorización son correctos

### Los webhooks no llegan

- Verifica la URL configurada en MercadoPago
- Prueba el endpoint manualmente con un payload de prueba
- Revisa los logs de `webhook-handler` en Supabase

### El usuario ve advertencia aunque ya pagó

- Verifica que `provider_subscription_id` esté guardado en la suscripción
- Revisa los logs del webhook para ver si se procesó
- El cache del frontend puede necesitar refrescarse

## Soporte

Para más ayuda:
1. Revisa los logs de Supabase Edge Functions
2. Verifica la configuración de MercadoPago
3. Prueba los endpoints manualmente con Postman o curl
4. Contacta al equipo de soporte
