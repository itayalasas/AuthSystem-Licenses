# Guía del Sistema de Gestión de Pagos y Suscripciones

## Descripción General

El sistema de pagos gestiona automáticamente:
- Períodos de prueba de las suscripciones
- Validación de vencimiento de pruebas
- Creación automática de pagos pendientes
- Procesamiento de pagos y activación de suscripciones
- Historial completo de pagos y cambios de estado

## Estructura del Sistema

### 1. Tablas de Base de Datos

#### `subscription_payments`
Registra todos los pagos de suscripciones:
- Estado del pago (pending, completed, failed, refunded)
- Monto y moneda
- Proveedor de pago (mercadopago, dlocal, stripe, manual)
- Período cubierto por el pago
- Metadata adicional

#### `subscription_status_history`
Mantiene historial de cambios de estado:
- Estado anterior y nuevo
- Razón del cambio
- Quién lo realizó (system, admin, user)
- Metadata del cambio

### 2. Edge Functions

#### `payment-processor`
Gestiona la lógica de pagos y períodos de prueba.

**Endpoints disponibles:**

##### GET `/subscription/:subscription_id/status`
Obtiene el estado completo de una suscripción:
```json
{
  "success": true,
  "data": {
    "subscription_id": "uuid",
    "status": "trialing",
    "is_in_trial": true,
    "trial_days_remaining": 10,
    "trial_end_date": "2024-11-14T00:00:00Z",
    "needs_payment": false,
    "days_until_expiry": 10,
    "plan": { ... },
    "tenant": { ... },
    "last_payment": null,
    "recent_payments": []
  }
}
```

##### POST `/initiate-payment`
Inicia un proceso de pago para una suscripción:
```json
{
  "subscription_id": "uuid",
  "payment_provider": "mercadopago",
  "return_url": "https://myapp.com/payment-success"
}
```

Respuesta:
```json
{
  "success": true,
  "data": {
    "payment_id": "uuid",
    "amount": 29.99,
    "currency": "USD",
    "payment_url": "...",
    "subscription": { ... }
  }
}
```

##### POST `/process-expiring-trials` (Cron Job)
Procesa pruebas que están por vencer en los próximos 3 días:
```json
{
  "success": true,
  "message": "Processed 5 expiring trials",
  "notifications_to_send": 5,
  "notifications": [...]
}
```

##### POST `/auto-process-payments` (Cron Job)
Crea automáticamente pagos pendientes para suscripciones vencidas:
```json
{
  "success": true,
  "message": "Processed 3 subscriptions, 0 failed",
  "processed": [...],
  "failed": []
}
```

##### GET `/pending-payments`
Lista todos los pagos pendientes:
```json
{
  "success": true,
  "count": 5,
  "data": [...]
}
```

#### `payment-manager`
Gestiona operaciones CRUD de pagos.

**Endpoints disponibles:**

##### POST `/payments`
Crea un nuevo registro de pago:
```json
{
  "subscription_id": "uuid",
  "amount": 29.99,
  "currency": "USD",
  "payment_provider": "mercadopago",
  "provider_transaction_id": "MP-123456",
  "metadata": {}
}
```

##### PUT `/payments/:id/complete`
Marca un pago como completado:
```json
{
  "provider_transaction_id": "MP-123456",
  "paid_at": "2024-11-04T12:00:00Z"
}
```

**Efecto:** Activa automáticamente la suscripción y extiende el período según el plan.

##### PUT `/payments/:id/fail`
Marca un pago como fallido:
```json
{
  "failure_reason": "Tarjeta rechazada"
}
```

##### POST `/payments/:id/refund`
Procesa un reembolso:
```json
{
  "amount": 29.99,
  "reason": "Cliente solicitó cancelación"
}
```

##### GET `/payments/subscription/:subscription_id`
Obtiene todos los pagos de una suscripción.

##### GET `/payments/tenant/:tenant_id`
Obtiene todos los pagos de un cliente.

##### POST `/check-trials`
Ejecuta verificación de pruebas expiradas.

##### POST `/check-renewals`
Ejecuta verificación de renovaciones de suscripciones.

##### GET `/status-history/:subscription_id`
Obtiene historial de cambios de estado.

### 3. Funciones de Base de Datos

#### `check_trial_expiration()`
Automáticamente:
- Busca suscripciones en estado 'trialing' con trial_end vencido
- Verifica si hay un pago completado
- Si no hay pago, cambia estado a 'past_due'
- Registra el cambio en el historial

#### `check_subscription_renewal()`
Automáticamente:
- Busca suscripciones activas con current_period_end vencido
- Verifica si hay un pago para el nuevo período
- Si no hay pago, cambia a 'past_due' con período de gracia de 3 días
- Después de 3 días, cambia a 'expired'
- Registra todos los cambios en el historial

#### `process_successful_payment(payment_id)`
Cuando un pago se completa:
- Activa la suscripción (estado 'active')
- Extiende current_period_end según el billing_cycle del plan
- Actualiza period_start y period_end
- Registra el cambio en el historial

#### `auto_activate_subscription_on_payment()` (Trigger)
Se ejecuta automáticamente cuando un pago cambia a 'completed':
- Si la suscripción está en 'trialing' o 'past_due'
- Llama a `process_successful_payment()`
- Activa la suscripción automáticamente

### 4. Componentes Frontend

#### `PaymentStatusCard`
Muestra el estado de una suscripción:
- Información del plan y precio
- Estado actual (trial, active, past_due, expired)
- Días restantes de prueba
- Días hasta renovación
- Historial de pagos recientes
- Botón para iniciar pago (si es necesario)

#### `PendingPaymentsView`
Vista administrativa de pagos pendientes:
- Lista todos los pagos en estado 'pending'
- Permite marcar como completado o fallido
- Actualización en tiempo real
- Filtrado y búsqueda

## Flujos de Trabajo

### Flujo 1: Nueva Suscripción con Período de Prueba

1. Cliente se registra y crea tenant
2. Sistema crea suscripción en estado 'trialing'
3. Se establece trial_end = now + trial_days del plan
4. Cliente usa el servicio durante la prueba
5. 3 días antes de que termine la prueba:
   - Cron job `/process-expiring-trials` detecta la suscripción
   - Genera notificación para enviar recordatorio
6. Al finalizar la prueba sin pago:
   - Función `check_trial_expiration()` cambia estado a 'past_due'
   - Se registra en el historial
7. Cliente inicia pago:
   - Se crea registro en `subscription_payments` con estado 'pending'
8. Pago se completa:
   - Se actualiza el pago a 'completed'
   - Trigger activa `process_successful_payment()`
   - Suscripción pasa a 'active'
   - Se extiende el período según el plan

### Flujo 2: Renovación de Suscripción Activa

1. Suscripción está 'active' con current_period_end próximo
2. Sistema crea pago pendiente automáticamente:
   - Cron job `/auto-process-payments` detecta la suscripción
   - Crea registro de pago 'pending'
   - Notifica al cliente
3. Cliente procesa el pago antes del vencimiento:
   - Pago cambia a 'completed'
   - Suscripción se renueva automáticamente
   - Nuevo current_period_end se establece
4. Si el cliente no paga:
   - Al vencer current_period_end, estado cambia a 'past_due'
   - Período de gracia de 3 días
   - Si no paga en 3 días, estado cambia a 'expired'

### Flujo 3: Procesamiento Manual de Pagos (Admin)

1. Admin accede a la sección "Pagos" en el dashboard
2. Ve lista de pagos pendientes
3. Cuando recibe confirmación de pago:
   - Hace clic en "Mark as Paid" en el pago correspondiente
   - Sistema actualiza el pago a 'completed'
   - Trigger automático activa la suscripción
4. Si el pago falla:
   - Hace clic en "Mark as Failed"
   - Sistema registra el fallo con razón

## Configuración de Cron Jobs

Para que el sistema funcione automáticamente, configura estos cron jobs:

### Verificación de Pruebas Expiradas (Cada hora)
```bash
curl -X POST https://your-supabase-url/functions/v1/payment-manager/check-trials \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

### Verificación de Renovaciones (Cada hora)
```bash
curl -X POST https://your-supabase-url/functions/v1/payment-manager/check-renewals \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

### Procesamiento de Pruebas que Expiran Pronto (Cada 24 horas)
```bash
curl -X POST https://your-supabase-url/functions/v1/payment-processor/process-expiring-trials \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

### Creación Automática de Pagos Pendientes (Cada 24 horas)
```bash
curl -X POST https://your-supabase-url/functions/v1/payment-processor/auto-process-payments \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

## Integración con Proveedores de Pago

El sistema está preparado para integrarse con:
- MercadoPago
- dLocal
- Stripe

Para integrar un proveedor:

1. Configura las credenciales en variables de entorno
2. Modifica `/initiate-payment` para crear la orden en el proveedor
3. Configura webhook para recibir notificaciones de pago
4. En el webhook, actualiza el estado del pago a 'completed' o 'failed'

## Monitoreo y Métricas

### Consultas Útiles

#### Pagos pendientes por más de 3 días
```sql
SELECT * FROM subscription_payments
WHERE status = 'pending'
AND created_at < NOW() - INTERVAL '3 days';
```

#### Suscripciones en riesgo de expirar
```sql
SELECT * FROM subscriptions
WHERE status IN ('trialing', 'past_due')
AND (trial_end < NOW() + INTERVAL '3 days' OR current_period_end < NOW() + INTERVAL '3 days');
```

#### Tasa de conversión de trial a paid
```sql
SELECT
  COUNT(*) FILTER (WHERE status IN ('active', 'past_due')) as converted,
  COUNT(*) FILTER (WHERE status = 'expired') as not_converted,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('active', 'past_due')) / COUNT(*), 2) as conversion_rate
FROM subscriptions
WHERE trial_start IS NOT NULL;
```

#### Ingresos por mes
```sql
SELECT
  DATE_TRUNC('month', paid_at) as month,
  COUNT(*) as payment_count,
  SUM(amount) as total_revenue,
  currency
FROM subscription_payments
WHERE status = 'completed'
GROUP BY month, currency
ORDER BY month DESC;
```

## Seguridad

- Todos los endpoints usan CORS headers apropiados
- Las tablas tienen RLS (Row Level Security) habilitado
- Solo service_role tiene acceso completo a los datos
- Los pagos incluyen validación de integridad
- El historial de cambios es inmutable

## Troubleshooting

### Problema: Suscripción no se activa después del pago
**Solución:** Verifica que el trigger `auto_activate_subscription_on_payment_trigger` esté activo.

### Problema: Pagos duplicados
**Solución:** El sistema valida pagos recientes antes de crear nuevos. Verifica la lógica en `/auto-process-payments`.

### Problema: Notificaciones no se envían
**Solución:** Los cron jobs solo generan la lista de notificaciones. Debes implementar el servicio de envío de emails.

## Próximos Pasos

1. Implementar integración con proveedores de pago reales
2. Agregar sistema de notificaciones por email
3. Crear dashboard de métricas y reportes
4. Implementar webhooks para proveedores de pago
5. Agregar pruebas automatizadas
