# Guía Completa de APIs Externas (Actualizada con external_app_id)

Esta guía documenta todas las APIs disponibles para integrar sistemas externos con el sistema de suscripciones **usando tu External App ID**.

## URLs Base

```
Admin API:              https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/admin-api
Tenant Onboarding:      https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/tenant-onboarding
Validation API:         https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/validation-api
Payment Processor:      https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-processor
Payment Manager:        https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-manager
```

## Tu External App ID

```
9acde27f-74d3-465e-aaec-94ad46faa881
```

Usa este ID en todas las APIs en lugar del ID interno de la base de datos.

## Autenticación

### Admin API
```
X-Admin-Token: admin_001
Content-Type: application/json
```

### Validation API
```
X-API-Key: ak_6f446cec5459486b7f8df385bbb903b
Content-Type: application/json
```

### Payment APIs
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW10aHVmbWZxaHh4eHpmbWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjY2MjUsImV4cCI6MjA3NzgwMjYyNX0.jAhRpp4ulEUuhTqEdMrcI2xhaMOJYA1RPnd-BDs2YIo
Content-Type: application/json
```

---

# APIs Principales (Usan external_app_id)

## 1. ONBOARDING - Crear Usuario/Tenant

Crea automáticamente un tenant cuando un usuario se registra en tu aplicación.

**Endpoint:** `POST /tenant-onboarding`

**Body:**
```json
{
  "external_app_id": "9acde27f-74d3-465e-aaec-94ad46faa881",
  "user_id": "user_123",
  "email": "usuario@ejemplo.com",
  "name": "Juan Pérez",
  "company_name": "Mi Empresa SAS",
  "start_trial": true
}
```

**cURL:**
```bash
curl -X POST \
  'https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/tenant-onboarding' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW10aHVmbWZxaHh4eHpmbWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjY2MjUsImV4cCI6MjA3NzgwMjYyNX0.jAhRpp4ulEUuhTqEdMrcI2xhaMOJYA1RPnd-BDs2YIo' \
  -H 'Content-Type: application/json' \
  -d '{
    "external_app_id": "9acde27f-74d3-465e-aaec-94ad46faa881",
    "user_id": "user_123",
    "email": "usuario@ejemplo.com",
    "name": "Juan Pérez",
    "company_name": "Mi Empresa SAS",
    "start_trial": true
  }'
```

---

## 2. VALIDACIÓN - Verificar Acceso de Usuario

Valida si un usuario tiene acceso activo a tu aplicación.

**Endpoint:** `POST /validation-api/validate-user`

**Body:**
```json
{
  "external_user_id": "user_123"
}
```

**cURL:**
```bash
curl -X POST \
  'https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/validation-api/validate-user' \
  -H 'X-API-Key: ak_6f446cec5459486b7f8df385bbb903b' \
  -H 'Content-Type: application/json' \
  -d '{
    "external_user_id": "user_123"
  }'
```

---

## 3. PAGOS - Consultar Estado de Suscripción por Usuario

Obtiene el estado de la suscripción usando external_app_id y user_id.

**Endpoint:** `GET /payment-processor/subscription/by-user`

**Query Params:**
- `external_app_id`: 9acde27f-74d3-465e-aaec-94ad46faa881
- `user_id`: user_123 (o `user_email`: usuario@ejemplo.com)

**cURL:**
```bash
curl -X GET \
  'https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-processor/subscription/by-user?external_app_id=9acde27f-74d3-465e-aaec-94ad46faa881&user_id=user_123' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW10aHVmbWZxaHh4eHpmbWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjY2MjUsImV4cCI6MjA3NzgwMjYyNX0.jAhRpp4ulEUuhTqEdMrcI2xhaMOJYA1RPnd-BDs2YIo' \
  -H 'Content-Type: application/json'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "subscription_id": "sub-uuid-456",
    "status": "trialing",
    "is_in_trial": true,
    "trial_days_remaining": 12,
    "trial_end_date": "2025-11-20T10:00:00.000Z",
    "needs_payment": false,
    "days_until_expiry": 12,
    "current_period_end": "2025-12-05T10:00:00.000Z",
    "plan": {
      "name": "Free",
      "price": 0,
      "currency": "USD"
    },
    "tenant": {
      "name": "Mi Empresa SAS",
      "owner_email": "usuario@ejemplo.com"
    }
  }
}
```

---

## 4. PAGOS - Iniciar Pago por Usuario

Crea un pago pendiente usando external_app_id y user_id.

**Endpoint:** `POST /payment-manager/payments/by-user`

**Body:**
```json
{
  "external_app_id": "9acde27f-74d3-465e-aaec-94ad46faa881",
  "user_id": "user_123",
  "payment_provider": "mercadopago",
  "payment_method": "credit_card",
  "metadata": {
    "source": "web_checkout"
  }
}
```

**cURL:**
```bash
curl -X POST \
  'https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-manager/payments/by-user' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW10aHVmbWZxaHh4eHpmbWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjY2MjUsImV4cCI6MjA3NzgwMjYyNX0.jAhRpp4ulEUuhTqEdMrcI2xhaMOJYA1RPnd-BDs2YIo' \
  -H 'Content-Type: application/json' \
  -d '{
    "external_app_id": "9acde27f-74d3-465e-aaec-94ad46faa881",
    "user_id": "user_123",
    "payment_provider": "mercadopago",
    "payment_method": "credit_card"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "payment-abc123",
    "subscription_id": "sub-uuid-456",
    "amount": 29.99,
    "currency": "USD",
    "status": "pending",
    "payment_provider": "mercadopago"
  },
  "subscription": {
    "id": "sub-uuid-456",
    "plan": "Free",
    "amount": 29.99,
    "currency": "USD"
  }
}
```

---

## 5. PAGOS - Completar Pago

Marca un pago como completado (después de recibir confirmación del proveedor).

**Endpoint:** `PUT /payment-manager/payments/{payment_id}/complete`

**Body:**
```json
{
  "provider_transaction_id": "MERC-PAY-123456",
  "metadata": {
    "payment_method": "credit_card",
    "last_4_digits": "4242"
  }
}
```

**cURL:**
```bash
curl -X PUT \
  'https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-manager/payments/payment-abc123/complete' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW10aHVmbWZxaHh4eHpmbWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjY2MjUsImV4cCI6MjA3NzgwMjYyNX0.jAhRpp4ulEUuhTqEdMrcI2xhaMOJYA1RPnd-BDs2YIo' \
  -H 'Content-Type: application/json' \
  -d '{
    "provider_transaction_id": "MERC-PAY-123456",
    "metadata": {
      "payment_method": "credit_card",
      "last_4_digits": "4242"
    }
  }'
```

---

# Flujo Completo de Integración

## 1. Registro de Usuario

```javascript
// Crear tenant automáticamente
const response = await fetch('https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/tenant-onboarding', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJI...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    external_app_id: '9acde27f-74d3-465e-aaec-94ad46faa881',
    user_id: 'user_123',
    email: 'usuario@ejemplo.com',
    name: 'Juan Pérez',
    company_name: 'Mi Empresa',
    start_trial: true
  })
});

const data = await response.json();
console.log('Tenant creado:', data.tenant.id);
console.log('Suscripción:', data.subscription.id);
```

## 2. Validar Acceso al Login

```javascript
// Validar acceso
const response = await fetch('https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/validation-api/validate-user', {
  method: 'POST',
  headers: {
    'X-API-Key': 'ak_6f446cec5459486b7f8df385bbb903b',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    external_user_id: 'user_123'
  })
});

const data = await response.json();

if (data.has_access) {
  console.log('Acceso permitido');
  // Guardar licencia para validaciones futuras
  localStorage.setItem('license_jti', data.license.jti);
} else {
  console.log('Acceso denegado - Redirigir a pago');
}
```

## 3. Verificar Estado de Suscripción

```javascript
// Consultar estado
const response = await fetch(
  'https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-processor/subscription/by-user?' +
  new URLSearchParams({
    external_app_id: '9acde27f-74d3-465e-aaec-94ad46faa881',
    user_id: 'user_123'
  }),
  {
    headers: {
      'Authorization': 'Bearer eyJhbGciOiJI...',
      'Content-Type': 'application/json'
    }
  }
);

const data = await response.json();

if (data.data.needs_payment) {
  console.log('Usuario necesita pagar');
  console.log('Días restantes de trial:', data.data.trial_days_remaining);
}
```

## 4. Iniciar Proceso de Pago

```javascript
// Crear pago pendiente
const response = await fetch('https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-manager/payments/by-user', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJI...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    external_app_id: '9acde27f-74d3-465e-aaec-94ad46faa881',
    user_id: 'user_123',
    payment_provider: 'mercadopago',
    payment_method: 'credit_card'
  })
});

const data = await response.json();
const paymentId = data.data.id;
const amount = data.subscription.amount;

// Redirigir al usuario a tu pasarela de pagos
// Pasando el paymentId y amount
```

## 5. Webhook de Confirmación de Pago

```javascript
// Cuando tu pasarela de pagos confirma el pago
// (Por ejemplo, en un webhook de MercadoPago)

const response = await fetch(
  `https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-manager/payments/${paymentId}/complete`,
  {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer eyJhbGciOiJI...',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      provider_transaction_id: 'MERC-PAY-123456',
      metadata: {
        payment_method: 'credit_card',
        last_4_digits: '4242'
      }
    })
  }
);

const data = await response.json();
console.log('Pago completado, suscripción activada automáticamente');
```

---

# Resumen de APIs por external_app_id

| Operación | Endpoint | Método | Usa external_app_id |
|-----------|----------|--------|---------------------|
| Crear usuario | `/tenant-onboarding` | POST | ✅ |
| Validar acceso | `/validation-api/validate-user` | POST | ✅ (via API Key) |
| Consultar suscripción | `/payment-processor/subscription/by-user` | GET | ✅ |
| Iniciar pago | `/payment-manager/payments/by-user` | POST | ✅ |
| Completar pago | `/payment-manager/payments/{id}/complete` | PUT | - |
| Consultar app | `/admin-api/applications/external/{id}` | GET | ✅ |

---

# Códigos de Estado

| Código | Descripción |
|--------|-------------|
| 200 | OK - Operación exitosa |
| 201 | Created - Recurso creado |
| 400 | Bad Request - Faltan parámetros |
| 401 | Unauthorized - Token inválido |
| 404 | Not Found - Recurso no encontrado |
| 500 | Internal Server Error |

---

# Notas Importantes

1. **Siempre usa external_app_id**: `9acde27f-74d3-465e-aaec-94ad46faa881`
2. **API Key**: Guarda de forma segura tu API Key
3. **Licencias**: Válidas por 24 horas
4. **Trial**: Por defecto 15 días
5. **Activación automática**: Los pagos completados activan la suscripción automáticamente via triggers de base de datos
