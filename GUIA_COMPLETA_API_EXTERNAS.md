# Guía Completa de APIs Externas

Esta guía documenta todas las APIs disponibles para integrar sistemas externos con el sistema de suscripciones.

## URLs Base

```
Admin API:              https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/admin-api
Tenant Onboarding:      https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/tenant-onboarding
Validation API:         https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/validation-api
Payment Processor:      https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-processor
Payment Manager:        https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-manager
```

## Autenticación

### Admin API
Usa el header `X-Admin-Token`:
```
X-Admin-Token: admin_001
Content-Type: application/json
```

### Validation API
Usa el header `X-API-Key` (el API Key de tu aplicación):
```
X-API-Key: ak_6f446cec5459486b7f8df385bbb903b
Content-Type: application/json
```

### Payment APIs
Usa el header `Authorization`:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW10aHVmbWZxaHh4eHpmbWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjY2MjUsImV4cCI6MjA3NzgwMjYyNX0.jAhRpp4ulEUuhTqEdMrcI2xhaMOJYA1RPnd-BDs2YIo
Content-Type: application/json
```

---

## 1. ONBOARDING - Crear Tenant (Usuario)

### Descripción
Crea automáticamente un tenant (cliente) para tu aplicación cuando un usuario se registra.

### Endpoint
`POST /tenant-onboarding`

### Request

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

**Postman:**
- Method: `POST`
- URL: `https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/tenant-onboarding`
- Headers:
  - `Authorization`: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW10aHVmbWZxaHh4eHpmbWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjY2MjUsImV4cCI6MjA3NzgwMjYyNX0.jAhRpp4ulEUuhTqEdMrcI2xhaMOJYA1RPnd-BDs2YIo`
  - `Content-Type`: `application/json`
- Body (raw JSON):
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

### Campos del Request

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `external_app_id` | string | Sí | ID de tu aplicación en tu sistema |
| `user_id` | string | Sí | ID del usuario en tu sistema |
| `email` | string | Sí | Email del usuario |
| `name` | string | Sí | Nombre del usuario |
| `company_name` | string | No | Nombre de la empresa |
| `subdomain` | string | No | Subdominio personalizado (se genera automáticamente si no se provee) |
| `plan_id` | string | No | ID del plan (usa "Free" por defecto) |
| `start_trial` | boolean | No | Iniciar con trial (default: true) |

### Response (201 Created)
```json
{
  "success": true,
  "message": "Tenant creado exitosamente",
  "tenant": {
    "id": "tenant-uuid-123",
    "name": "Mi Empresa SAS",
    "organization_name": "Mi Empresa SAS",
    "owner_user_id": "user_123",
    "owner_email": "usuario@ejemplo.com",
    "billing_email": "usuario@ejemplo.com",
    "domain": "mi-empresa-sas-x7k2.netlify.app",
    "status": "active",
    "metadata": {
      "subdomain": "mi-empresa-sas-x7k2",
      "created_via": "auto-onboarding",
      "external_app_id": "9acde27f-74d3-465e-aaec-94ad46faa881",
      "onboarded_at": "2025-11-05T10:00:00.000Z"
    },
    "created_at": "2025-11-05T10:00:00.000Z"
  },
  "subscription": {
    "id": "sub-uuid-456",
    "tenant_id": "tenant-uuid-123",
    "status": "trialing",
    "trial_start": "2025-11-05T10:00:00.000Z",
    "trial_end": "2025-11-20T10:00:00.000Z",
    "period_start": "2025-11-05T10:00:00.000Z",
    "period_end": "2025-12-05T10:00:00.000Z",
    "plan": {
      "id": "plan-uuid",
      "name": "Free",
      "price": 0,
      "currency": "USD",
      "billing_cycle": "monthly",
      "trial_days": 15
    }
  },
  "tenant_application": {
    "id": "ta-uuid-789",
    "tenant_id": "tenant-uuid-123",
    "application_id": "app-internal-uuid",
    "subscription_id": "sub-uuid-456",
    "status": "active",
    "granted_by": "system"
  },
  "is_new": true
}
```

### Response - Usuario Existente (200 OK)
Si el usuario ya tiene un tenant, devuelve el existente:
```json
{
  "success": true,
  "message": "El usuario ya tiene un tenant existente",
  "tenant": { ... },
  "tenant_application": { ... },
  "is_new": false
}
```

---

## 2. VALIDACIÓN - Verificar Acceso de Usuario

### Descripción
Valida si un usuario tiene acceso activo a tu aplicación y genera un token de licencia temporal.

### Endpoint
`POST /validation-api/validate-user`

### Request

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

**Postman:**
- Method: `POST`
- URL: `https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/validation-api/validate-user`
- Headers:
  - `X-API-Key`: `ak_6f446cec5459486b7f8df385bbb903b`
  - `Content-Type`: `application/json`
- Body (raw JSON):
```json
{
  "external_user_id": "user_123"
}
```

O usando email:
```json
{
  "user_email": "usuario@ejemplo.com"
}
```

### Response - Usuario con Acceso (200 OK)
```json
{
  "success": true,
  "has_access": true,
  "tenant": {
    "id": "tenant-uuid-123",
    "name": "Mi Empresa SAS",
    "owner_user_id": "user_123",
    "owner_email": "usuario@ejemplo.com",
    "status": "active"
  },
  "subscription": {
    "id": "sub-uuid-456",
    "status": "trialing",
    "trial_end": "2025-11-20T10:00:00.000Z",
    "period_end": "2025-12-05T10:00:00.000Z",
    "plan": {
      "name": "Free",
      "price": 0,
      "entitlements": {
        "max_users": 5,
        "features": {
          "advanced_reports": true,
          "api_access": true
        }
      }
    }
  },
  "license": {
    "jti": "lic-uuid-abc",
    "tenant_id": "tenant-uuid-123",
    "expires_at": "2025-11-06T10:00:00.000Z",
    "entitlements": {
      "max_users": 5,
      "features": {
        "advanced_reports": true,
        "api_access": true
      }
    }
  }
}
```

### Response - Usuario sin Acceso (200 OK)
```json
{
  "success": true,
  "has_access": false,
  "message": "User does not have access to this application"
}
```

---

## 3. VALIDACIÓN - Verificar Licencia

### Descripción
Valida un token de licencia previamente generado.

### Endpoint
`POST /validation-api/validate-license`

### Request

**cURL:**
```bash
curl -X POST \
  'https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/validation-api/validate-license' \
  -H 'X-API-Key: ak_6f446cec5459486b7f8df385bbb903b' \
  -H 'Content-Type: application/json' \
  -d '{
    "jti": "lic-uuid-abc"
  }'
```

### Response - Licencia Válida (200 OK)
```json
{
  "success": true,
  "valid": true,
  "license": {
    "jti": "lic-uuid-abc",
    "tenant_id": "tenant-uuid-123",
    "type": "trial",
    "expires_at": "2025-11-06T10:00:00.000Z",
    "entitlements": {
      "max_users": 5,
      "features": {
        "advanced_reports": true,
        "api_access": true
      }
    }
  },
  "subscription": {
    "id": "sub-uuid-456",
    "status": "trialing",
    "plan": {
      "name": "Free",
      "price": 0
    }
  }
}
```

### Response - Licencia Inválida (200 OK)
```json
{
  "success": true,
  "valid": false,
  "reason": "License expired"
}
```

---

## 4. CONSULTAS - Obtener Información de Aplicación

### Descripción
Obtiene información de tu aplicación usando el External App ID.

### Endpoint
`GET /admin-api/applications/external/{external_app_id}`

### Request

**cURL:**
```bash
curl -X GET \
  'https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/admin-api/applications/external/9acde27f-74d3-465e-aaec-94ad46faa881' \
  -H 'X-Admin-Token: admin_001' \
  -H 'Content-Type: application/json'
```

### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "app-internal-uuid",
    "name": "Creador Apis",
    "slug": "creador-apis",
    "external_app_id": "9acde27f-74d3-465e-aaec-94ad46faa881",
    "api_key": "ak_6f446cec5459486b7f8df385bbb903b",
    "webhook_url": "dashboard.authsystem.local",
    "max_users": 0,
    "plan_id": null,
    "is_active": true,
    "settings": {},
    "created_at": "2025-11-05T10:00:00.000Z",
    "updated_at": "2025-11-05T10:00:00.000Z",
    "users_count": 0
  }
}
```

---

## 5. PAGOS - Consultar Estado de Suscripción

### Descripción
Obtiene el estado detallado de una suscripción, incluyendo trial y pagos.

### Endpoint
`GET /payment-processor/subscription/{subscription_id}/status`

### Request

**cURL:**
```bash
curl -X GET \
  'https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-processor/subscription/sub-uuid-456/status' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW10aHVmbWZxaHh4eHpmbWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjY2MjUsImV4cCI6MjA3NzgwMjYyNX0.jAhRpp4ulEUuhTqEdMrcI2xhaMOJYA1RPnd-BDs2YIo' \
  -H 'Content-Type: application/json'
```

### Response (200 OK)
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
      "id": "plan-uuid",
      "name": "Free",
      "price": 0,
      "currency": "USD",
      "billing_cycle": "monthly"
    },
    "tenant": {
      "name": "Mi Empresa SAS",
      "owner_email": "usuario@ejemplo.com"
    },
    "last_payment": null,
    "recent_payments": []
  }
}
```

---

## 6. PAGOS - Marcar Pago como Completado

### Descripción
Marca un pago como completado después de recibir confirmación del proveedor de pagos.

### Endpoint
`PUT /payment-manager/payments/{payment_id}/complete`

### Request

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

### Response (200 OK)
```json
{
  "success": true,
  "message": "Payment completed successfully. Subscription will be activated automatically.",
  "data": {
    "id": "payment-abc123",
    "subscription_id": "sub-uuid-456",
    "status": "completed",
    "amount": 29.99,
    "currency": "USD",
    "paid_at": "2025-11-05T10:30:00.000Z",
    "provider_transaction_id": "MERC-PAY-123456"
  }
}
```

---

## Flujo de Integración Recomendado

### 1. Cuando un usuario se registra en tu sistema:

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
// Guardar data.tenant.id y data.subscription.id en tu base de datos
```

### 2. Cuando un usuario intenta acceder a tu aplicación:

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
  // Usuario tiene acceso válido
  // Guardar data.license.jti para futuras validaciones
  console.log('Acceso permitido');
} else {
  // Redirigir a página de pago
  console.log('Acceso denegado');
}
```

### 3. Cuando recibes un webhook de pago:

```javascript
// Marcar pago como completado
const response = await fetch(`https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-manager/payments/${paymentId}/complete`, {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJI...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    provider_transaction_id: 'MERC-PAY-123456',
    metadata: {
      payment_method: 'credit_card'
    }
  })
});

const data = await response.json();
// La suscripción se activará automáticamente
```

---

## Códigos de Estado HTTP

| Código | Descripción |
|--------|-------------|
| 200 | Operación exitosa |
| 201 | Recurso creado exitosamente |
| 400 | Petición inválida (faltan campos requeridos) |
| 401 | No autorizado (API key o token inválido) |
| 404 | Recurso no encontrado |
| 500 | Error interno del servidor |

---

## Notas Importantes

1. **External App ID**: Usa siempre el ID de tu sistema (`9acde27f-74d3-465e-aaec-94ad46faa881`) en lugar del ID interno
2. **API Key**: Guarda tu API Key de forma segura (`ak_6f446cec5459486b7f8df385bbb903b`)
3. **Licencias**: Son válidas por 24 horas y deben renovarse periódicamente
4. **Trial**: Por defecto dura 15 días (configurable por plan)
5. **Activación automática**: Cuando marcas un pago como completado, la suscripción se activa automáticamente via trigger de base de datos

---

## Soporte

Para más información sobre otros endpoints disponibles, consulta la documentación completa en:
- `GUIA_API_PAGOS.md` - APIs de pagos detalladas
- `MANUAL_DE_USO.md` - Manual general del sistema
