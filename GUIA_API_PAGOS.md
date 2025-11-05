# Guía de API de Pagos - Ejemplos de Uso

## URLs Base

```
Base URL Payment Processor: https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-processor
Base URL Payment Manager: https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-manager
```

## Headers Requeridos

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW10aHVmbWZxaHh4eHpmbWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjY2MjUsImV4cCI6MjA3NzgwMjYyNX0.jAhRpp4ulEUuhTqEdMrcI2xhaMOJYA1RPnd-BDs2YIo
Content-Type: application/json
```

---

## 1. Consultar Estado de Suscripción

### Descripción
Obtiene el estado completo de una suscripción, incluyendo información de trial, pagos pendientes y historial.

### Request

**cURL:**
```bash
curl -X GET \
  'https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-processor/subscription/SUBSCRIPTION_ID/status' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW10aHVmbWZxaHh4eHpmbWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjY2MjUsImV4cCI6MjA3NzgwMjYyNX0.jAhRpp4ulEUuhTqEdMrcI2xhaMOJYA1RPnd-BDs2YIo' \
  -H 'Content-Type: application/json'
```

**Postman:**
- Method: `GET`
- URL: `https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-processor/subscription/SUBSCRIPTION_ID/status`
- Headers:
  - `Authorization`: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW10aHVmbWZxaHh4eHpmbWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjY2MjUsImV4cCI6MjA3NzgwMjYyNX0.jAhRpp4ulEUuhTqEdMrcI2xhaMOJYA1RPnd-BDs2YIo`
  - `Content-Type`: `application/json`

### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "subscription_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "trialing",
    "is_in_trial": true,
    "trial_days_remaining": 12,
    "trial_end_date": "2025-11-17T00:00:00.000Z",
    "needs_payment": false,
    "days_until_expiry": 12,
    "current_period_end": "2025-11-17T00:00:00.000Z",
    "plan": {
      "id": "plan-123",
      "name": "Premium",
      "price": 29.99,
      "currency": "USD",
      "billing_cycle": "monthly"
    },
    "tenant": {
      "name": "Mi Empresa",
      "owner_email": "admin@miempresa.com"
    },
    "last_payment": null,
    "recent_payments": []
  }
}
```

---

## 2. Iniciar Pago

### Descripción
Crea un registro de pago pendiente para una suscripción.

### Request

**cURL:**
```bash
curl -X POST \
  'https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-processor/initiate-payment' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW10aHVmbWZxaHh4eHpmbWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjY2MjUsImV4cCI6MjA3NzgwMjYyNX0.jAhRpp4ulEUuhTqEdMrcI2xhaMOJYA1RPnd-BDs2YIo' \
  -H 'Content-Type: application/json' \
  -d '{
    "subscription_id": "550e8400-e29b-41d4-a716-446655440000",
    "payment_provider": "manual",
    "return_url": "https://miapp.com/payment-success"
  }'
```

**Postman:**
- Method: `POST`
- URL: `https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-processor/initiate-payment`
- Headers:
  - `Authorization`: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW10aHVmbWZxaHh4eHpmbWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjY2MjUsImV4cCI6MjA3NzgwMjYyNX0.jAhRpp4ulEUuhTqEdMrcI2xhaMOJYA1RPnd-BDs2YIo`
  - `Content-Type`: `application/json`
- Body (raw JSON):
```json
{
  "subscription_id": "550e8400-e29b-41d4-a716-446655440000",
  "payment_provider": "manual",
  "return_url": "https://miapp.com/payment-success"
}
```

### Response (201 Created)
```json
{
  "success": true,
  "data": {
    "payment_id": "payment-abc123",
    "amount": 29.99,
    "currency": "USD",
    "payment_url": "https://miapp.com/payment-success?payment_id=payment-abc123&amount=29.99&currency=USD",
    "subscription": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "plan": "Premium",
      "status": "trialing"
    }
  }
}
```

---

## 3. Obtener Pagos Pendientes

### Descripción
Lista todos los pagos que están en estado pendiente.

### Request

**cURL:**
```bash
curl -X GET \
  'https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-processor/pending-payments' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW10aHVmbWZxaHh4eHpmbWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjY2MjUsImV4cCI6MjA3NzgwMjYyNX0.jAhRpp4ulEUuhTqEdMrcI2xhaMOJYA1RPnd-BDs2YIo' \
  -H 'Content-Type: application/json'
```

**Postman:**
- Method: `GET`
- URL: `https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-processor/pending-payments`
- Headers: (mismos de antes)

### Response (200 OK)
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "payment-abc123",
      "subscription_id": "550e8400-e29b-41d4-a716-446655440000",
      "tenant_id": "tenant-xyz",
      "amount": 29.99,
      "currency": "USD",
      "status": "pending",
      "payment_provider": "manual",
      "created_at": "2025-11-05T10:00:00.000Z",
      "subscription": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "status": "trialing",
        "plan": {
          "name": "Premium",
          "price": 29.99
        },
        "tenant": {
          "name": "Mi Empresa",
          "owner_email": "admin@miempresa.com"
        }
      }
    }
  ]
}
```

---

## 4. Marcar Pago como Completado

### Descripción
Actualiza el estado de un pago a completado. Esto activará automáticamente la suscripción.

### Request

**cURL:**
```bash
curl -X PUT \
  'https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-manager/payments/payment-abc123/complete' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW10aHVmbWZxaHh4eHpmbWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjY2MjUsImV4cCI6MjA3NzgwMjYyNX0.jAhRpp4ulEUuhTqEdMrcI2xhaMOJYA1RPnd-BDs2YIo' \
  -H 'Content-Type: application/json' \
  -d '{
    "provider_transaction_id": "MERC-PAY-123456",
    "paid_at": "2025-11-05T10:30:00.000Z",
    "metadata": {
      "payment_method": "credit_card",
      "last_4_digits": "4242"
    }
  }'
```

**Postman:**
- Method: `PUT`
- URL: `https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-manager/payments/payment-abc123/complete`
- Headers: (mismos de antes)
- Body (raw JSON):
```json
{
  "provider_transaction_id": "MERC-PAY-123456",
  "paid_at": "2025-11-05T10:30:00.000Z",
  "metadata": {
    "payment_method": "credit_card",
    "last_4_digits": "4242"
  }
}
```

### Response (200 OK)
```json
{
  "success": true,
  "message": "Payment completed successfully. Subscription will be activated automatically.",
  "data": {
    "id": "payment-abc123",
    "subscription_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "amount": 29.99,
    "currency": "USD",
    "paid_at": "2025-11-05T10:30:00.000Z",
    "provider_transaction_id": "MERC-PAY-123456"
  }
}
```

---

## 5. Marcar Pago como Fallido

### Descripción
Marca un pago como fallido cuando no se pudo procesar.

### Request

**cURL:**
```bash
curl -X PUT \
  'https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-manager/payments/payment-abc123/fail' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW10aHVmbWZxaHh4eHpmbWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjY2MjUsImV4cCI6MjA3NzgwMjYyNX0.jAhRpp4ulEUuhTqEdMrcI2xhaMOJYA1RPnd-BDs2YIo' \
  -H 'Content-Type: application/json' \
  -d '{
    "failure_reason": "Insufficient funds",
    "metadata": {
      "error_code": "INSUF_FUNDS",
      "attempts": 1
    }
  }'
```

**Postman:**
- Method: `PUT`
- URL: `https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-manager/payments/payment-abc123/fail`
- Headers: (mismos de antes)
- Body (raw JSON):
```json
{
  "failure_reason": "Insufficient funds",
  "metadata": {
    "error_code": "INSUF_FUNDS",
    "attempts": 1
  }
}
```

### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "payment-abc123",
    "subscription_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "failed",
    "amount": 29.99,
    "currency": "USD",
    "failure_reason": "Insufficient funds",
    "failed_at": "2025-11-05T10:35:00.000Z"
  }
}
```

---

## 6. Historial de Pagos de Suscripción

### Descripción
Obtiene todos los pagos asociados a una suscripción específica.

### Request

**cURL:**
```bash
curl -X GET \
  'https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-manager/payments/subscription/550e8400-e29b-41d4-a716-446655440000' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW10aHVmbWZxaHh4eHpmbWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjY2MjUsImV4cCI6MjA3NzgwMjYyNX0.jAhRpp4ulEUuhTqEdMrcI2xhaMOJYA1RPnd-BDs2YIo' \
  -H 'Content-Type: application/json'
```

**Postman:**
- Method: `GET`
- URL: `https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-manager/payments/subscription/550e8400-e29b-41d4-a716-446655440000`
- Headers: (mismos de antes)

### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "payment-abc123",
      "subscription_id": "550e8400-e29b-41d4-a716-446655440000",
      "amount": 29.99,
      "currency": "USD",
      "status": "completed",
      "payment_provider": "mercadopago",
      "provider_transaction_id": "MERC-PAY-123456",
      "paid_at": "2025-11-05T10:30:00.000Z",
      "created_at": "2025-11-05T10:00:00.000Z",
      "period_start": "2025-11-05T00:00:00.000Z",
      "period_end": "2025-12-05T00:00:00.000Z"
    },
    {
      "id": "payment-def456",
      "subscription_id": "550e8400-e29b-41d4-a716-446655440000",
      "amount": 29.99,
      "currency": "USD",
      "status": "pending",
      "payment_provider": "manual",
      "created_at": "2025-10-05T10:00:00.000Z"
    }
  ]
}
```

---

## 7. Historial de Pagos de Tenant

### Descripción
Obtiene todos los pagos de un tenant (cliente), incluyendo todas sus suscripciones.

### Request

**cURL:**
```bash
curl -X GET \
  'https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-manager/payments/tenant/tenant-xyz' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW10aHVmbWZxaHh4eHpmbWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjY2MjUsImV4cCI6MjA3NzgwMjYyNX0.jAhRpp4ulEUuhTqEdMrcI2xhaMOJYA1RPnd-BDs2YIo' \
  -H 'Content-Type: application/json'
```

**Postman:**
- Method: `GET`
- URL: `https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-manager/payments/tenant/tenant-xyz`
- Headers: (mismos de antes)

### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "payment-abc123",
      "tenant_id": "tenant-xyz",
      "subscription_id": "550e8400-e29b-41d4-a716-446655440000",
      "amount": 29.99,
      "currency": "USD",
      "status": "completed",
      "paid_at": "2025-11-05T10:30:00.000Z",
      "subscription": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "status": "active",
        "plan": {
          "name": "Premium",
          "price": 29.99,
          "billing_cycle": "monthly"
        }
      }
    }
  ]
}
```

---

## 8. Historial de Cambios de Estado

### Descripción
Obtiene el historial completo de cambios de estado de una suscripción.

### Request

**cURL:**
```bash
curl -X GET \
  'https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-manager/status-history/550e8400-e29b-41d4-a716-446655440000' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW10aHVmbWZxaHh4eHpmbWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjY2MjUsImV4cCI6MjA3NzgwMjYyNX0.jAhRpp4ulEUuhTqEdMrcI2xhaMOJYA1RPnd-BDs2YIo' \
  -H 'Content-Type: application/json'
```

**Postman:**
- Method: `GET`
- URL: `https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-manager/status-history/550e8400-e29b-41d4-a716-446655440000`
- Headers: (mismos de antes)

### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "history-1",
      "subscription_id": "550e8400-e29b-41d4-a716-446655440000",
      "old_status": "trialing",
      "new_status": "active",
      "reason": "payment_completed",
      "changed_by": "system",
      "created_at": "2025-11-05T10:30:00.000Z"
    },
    {
      "id": "history-2",
      "subscription_id": "550e8400-e29b-41d4-a716-446655440000",
      "old_status": null,
      "new_status": "trialing",
      "reason": "subscription_created",
      "changed_by": "admin",
      "created_at": "2025-10-22T08:00:00.000Z"
    }
  ]
}
```

---

## Configuración en Postman (Colección Completa)

### 1. Crear Environment en Postman

Ve a Environments → Create Environment y agrega:

```
BASE_URL_PROCESSOR: https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-processor
BASE_URL_MANAGER: https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/payment-manager
AUTH_TOKEN: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW10aHVmbWZxaHh4eHpmbWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjY2MjUsImV4cCI6MjA3NzgwMjYyNX0.jAhRpp4ulEUuhTqEdMrcI2xhaMOJYA1RPnd-BDs2YIo
```

### 2. Headers Pre-configurados

En cada request, agrega estos headers:
- `Authorization`: `Bearer {{AUTH_TOKEN}}`
- `Content-Type`: `application/json`

---

## Códigos de Error Comunes

### 404 Not Found
```json
{
  "success": false,
  "error": "Subscription not found"
}
```

### 400 Bad Request
```json
{
  "success": false,
  "error": "Can only refund completed payments"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Database connection failed"
}
```

---

## Flujo Típico de Pago

1. **Verificar estado**: `GET /subscription/:id/status`
2. **Iniciar pago**: `POST /initiate-payment`
3. **Usuario paga externamente** (MercadoPago, transferencia, etc.)
4. **Confirmar pago**: `PUT /payments/:id/complete`
5. **Sistema activa suscripción automáticamente** (via trigger de base de datos)

---

## Notas Importantes

1. Todas las fechas están en formato ISO 8601 (UTC)
2. Los montos son números decimales (ej: 29.99)
3. El token de autorización nunca expira (configurado para 2077)
4. Las APIs tienen CORS habilitado para todos los orígenes
5. No se requiere autenticación JWT adicional (verifyJWT: false)
