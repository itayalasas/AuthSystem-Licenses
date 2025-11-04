# Sistema de Gestión de Pagos

Este documento describe el sistema completo de gestión de pagos y períodos de prueba implementado en la plataforma.

## Características Principales

### 1. Gestión de Períodos de Prueba
- **Inicio automático**: Cuando se crea un tenant, inicia automáticamente con período de prueba
- **Duración configurable**: Cada plan define sus días de prueba (por defecto 14 días)
- **Transición automática**: Al finalizar el período de prueba sin pago, cambia a estado `past_due`

### 2. Registro de Pagos
Todos los pagos se registran en la tabla `subscription_payments` con:
- Monto y moneda
- Método y proveedor de pago
- Estado del pago (pending, processing, completed, failed, refunded)
- IDs de transacción del proveedor
- Período cubierto por el pago
- Metadatos adicionales

### 3. Estados de Suscripción
- **trialing**: En período de prueba
- **active**: Suscripción activa con pago al día
- **past_due**: Pago vencido (período de gracia de 3 días)
- **expired**: Suscripción expirada (después del período de gracia)
- **canceled**: Cancelada por el usuario
- **paused**: Pausada temporalmente

### 4. Transiciones Automáticas
El sistema incluye funciones automáticas que verifican:

#### a) Expiración de Pruebas (`check_trial_expiration`)
- Ejecutar diariamente
- Verifica suscripciones en estado `trialing` con fecha de prueba vencida
- Si no hay pago registrado, cambia a `past_due`

#### b) Renovación de Suscripciones (`check_subscription_renewal`)
- Ejecutar diariamente
- Verifica suscripciones activas con período vencido
- Cambia a `past_due` si no hay pago
- Después de 3 días en `past_due`, cambia a `expired`

#### c) Activación por Pago (`auto_activate_subscription_on_payment`)
- Se ejecuta automáticamente al registrar un pago completado
- Activa la suscripción
- Extiende el período según el plan (mensual o anual)

### 5. Historial de Cambios
Todos los cambios de estado se registran automáticamente en `subscription_status_history`:
- Estado anterior y nuevo
- Razón del cambio
- Quién realizó el cambio (system, admin, user)
- Metadatos del cambio

## API de Pagos

### Endpoint: `/payment-manager`

#### 1. Crear Pago
```http
POST /payment-manager/payments
Content-Type: application/json

{
  "subscription_id": "uuid",
  "amount": 45.00,
  "currency": "USD",
  "payment_method": "credit_card",
  "payment_provider": "mercadopago",
  "provider_transaction_id": "mp_12345",
  "provider_customer_id": "cust_67890"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "subscription_id": "uuid",
    "status": "pending",
    "amount": 45.00,
    "period_start": "2025-11-04T00:00:00Z",
    "period_end": "2025-12-04T00:00:00Z"
  }
}
```

#### 2. Completar Pago
```http
PUT /payment-manager/payments/{payment_id}/complete
Content-Type: application/json

{
  "provider_transaction_id": "mp_12345_confirmed",
  "paid_at": "2025-11-04T10:30:00Z"
}
```

**Efecto:**
- Marca el pago como completado
- Activa automáticamente la suscripción
- Extiende el período según el plan

#### 3. Marcar Pago como Fallido
```http
PUT /payment-manager/payments/{payment_id}/fail
Content-Type: application/json

{
  "failure_reason": "Insufficient funds"
}
```

#### 4. Procesar Reembolso
```http
POST /payment-manager/payments/{payment_id}/refund
Content-Type: application/json

{
  "amount": 45.00,
  "reason": "Customer request"
}
```

**Nota:** Puede ser reembolso parcial o total

#### 5. Consultar Pagos de Suscripción
```http
GET /payment-manager/payments/subscription/{subscription_id}
```

#### 6. Consultar Pagos de Tenant
```http
GET /payment-manager/payments/tenant/{tenant_id}
```

#### 7. Verificar Pruebas Expiradas (Cron)
```http
POST /payment-manager/check-trials
```

#### 8. Verificar Renovaciones (Cron)
```http
POST /payment-manager/check-renewals
```

#### 9. Historial de Estados
```http
GET /payment-manager/status-history/{subscription_id}
```

## Flujo de Pago Completo

### Escenario 1: Nueva Suscripción con Prueba
1. Usuario se registra → Se crea tenant con suscripción `trialing`
2. Período de prueba: 14 días
3. Durante la prueba: Usuario tiene acceso completo
4. Día 14: Sistema verifica si hay pago
   - **Con pago**: Continúa como `active`
   - **Sin pago**: Cambia a `past_due`

### Escenario 2: Pago Durante Período de Prueba
1. Usuario decide pagar antes de que expire la prueba
2. Se crea registro de pago con estado `pending`
3. Proveedor confirma el pago
4. Se marca pago como `completed`
5. **Trigger automático**: Suscripción cambia a `active`
6. Se extiende el período según el plan

### Escenario 3: Renovación de Suscripción Activa
1. Suscripción activa llega a `period_end`
2. Sistema verifica si hay pago para el siguiente período
   - **Con pago**: Se extiende el período automáticamente
   - **Sin pago**: Cambia a `past_due`
3. Período de gracia: 3 días
4. Después de 3 días sin pago: Cambia a `expired`

### Escenario 4: Pago Fallido
1. Se intenta procesar pago → Falla
2. Se marca como `failed` con razón del fallo
3. Se puede reintentar el pago
4. Usuario recibe notificación (si está configurado webhook)

## Configuración de Cron Jobs

Para automatizar las verificaciones, configurar estos cron jobs:

### Verificación Diaria de Pruebas
```bash
# Ejecutar todos los días a las 2:00 AM
curl -X POST https://[project-id].supabase.co/functions/v1/payment-manager/check-trials \
  -H "Authorization: Bearer [anon-key]"
```

### Verificación Diaria de Renovaciones
```bash
# Ejecutar todos los días a las 3:00 AM
curl -X POST https://[project-id].supabase.co/functions/v1/payment-manager/check-renewals \
  -H "Authorization: Bearer [anon-key]"
```

## Integraciones con Proveedores de Pago

### Mercado Pago
1. Crear preferencia de pago en Mercado Pago
2. Registrar pago en sistema con `payment_provider: "mercadopago"`
3. Al recibir webhook de Mercado Pago, marcar pago como completado

### dLocal
Similar a Mercado Pago, usando `payment_provider: "dlocal"`

### Stripe
Similar, usando `payment_provider: "stripe"`

## Vista Consolidada de Pagos

La vista `subscription_payment_summary` proporciona un resumen por suscripción:

```sql
SELECT * FROM subscription_payment_summary WHERE tenant_id = 'uuid';
```

**Información incluida:**
- Total de pagos realizados
- Pagos exitosos vs fallidos
- Monto total pagado
- Fecha del último pago
- Estado de la suscripción

## Monitoreo y Auditoría

### Historial de Estados
Todos los cambios de estado quedan registrados:

```sql
SELECT
  from_status,
  to_status,
  reason,
  changed_by,
  created_at
FROM subscription_status_history
WHERE subscription_id = 'uuid'
ORDER BY created_at DESC;
```

### Pagos Pendientes
```sql
SELECT
  sp.*,
  t.name as tenant_name,
  p.name as plan_name
FROM subscription_payments sp
JOIN tenants t ON t.id = sp.tenant_id
JOIN plans p ON p.id = sp.plan_id
WHERE sp.status = 'pending'
ORDER BY sp.created_at;
```

### Suscripciones en Riesgo
```sql
SELECT
  s.*,
  t.name as tenant_name,
  s.current_period_end
FROM subscriptions s
JOIN tenants t ON t.id = s.tenant_id
WHERE s.status = 'past_due'
  AND s.current_period_end < now() - interval '2 days'
ORDER BY s.current_period_end;
```

## Mejores Prácticas

1. **Verificaciones Automáticas**: Configurar cron jobs diarios
2. **Webhooks**: Configurar webhooks de proveedores de pago para actualización en tiempo real
3. **Notificaciones**: Enviar emails cuando:
   - Prueba está por vencer (3 días antes)
   - Pago falló
   - Suscripción cambió a `past_due`
   - Suscripción está por expirar
4. **Auditoría**: Revisar regularmente el historial de cambios
5. **Reconciliación**: Comparar pagos del sistema con reportes de proveedores

## Seguridad

- Todos los endpoints usan RLS (Row Level Security)
- Solo service role puede modificar pagos
- Proveedores de pago deben validar webhooks con firma
- IDs de transacción se almacenan para trazabilidad
- Metadatos permiten almacenar información adicional sin exponer datos sensibles
