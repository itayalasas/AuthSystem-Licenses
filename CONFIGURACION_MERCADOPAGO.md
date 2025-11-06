# Configuración de MercadoPago

Este documento explica cómo configurar MercadoPago para procesar pagos recurrentes en el sistema.

## Variables Requeridas

Para habilitar la integración con MercadoPago, debes configurar las siguientes variables en tu API de configuración externa:

### 1. MERCADOPAGO_ACCESS_TOKEN
**Descripción:** Token de acceso de MercadoPago para autenticar las solicitudes API.

**Cómo obtenerlo:**
1. Inicia sesión en tu cuenta de MercadoPago
2. Ve a [Tus integraciones → Credenciales](https://www.mercadopago.com.ar/developers/panel/credentials)
3. Selecciona "Credenciales de producción" o "Credenciales de prueba"
4. Copia el **Access Token**

**Ejemplo:**
```
TEST-1234567890123456-123456-abcdef123456789012345678901234-123456789
```

### 2. MERCADOPAGO_BACK_URL
**Descripción:** URL a la que MercadoPago redirigirá después de que el usuario complete el proceso de suscripción.

**Formato:**
```
https://tu-dominio.com/suscripcion-exitosa
```

**Recomendaciones:**
- Usa HTTPS en producción
- Crea una página específica para recibir a usuarios después del pago
- Puedes incluir parámetros de query para tracking: `?source=mercadopago&plan_id={PLAN_ID}`

### 3. MERCADOPAGO_API_URL (Opcional)
**Descripción:** URL del endpoint de MercadoPago para crear planes de suscripción.

**Valor por defecto:**
```
https://api.mercadopago.com/preapproval_plan
```

**Nota:** Solo necesitas configurar esta variable si usas un endpoint diferente o un proxy.

## Configuración en la API Externa

Las variables deben configurarse en tu API de configuración externa que responde al endpoint:
```
https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/get-env
```

Esta API debe incluir en la respuesta JSON las nuevas variables:

```json
{
  "project_name": "Mi Proyecto",
  "description": "Configuración del proyecto",
  "variables": {
    "VITE_SUPABASE_URL": "https://...",
    "VITE_SUPABASE_ANON_KEY": "...",
    "MERCADOPAGO_ACCESS_TOKEN": "TEST-...",
    "MERCADOPAGO_BACK_URL": "https://tu-dominio.com/suscripcion-exitosa",
    "MERCADOPAGO_API_URL": "https://api.mercadopago.com/preapproval_plan"
  },
  "updated_at": "2025-11-06T00:00:00Z"
}
```

## Configuración en Supabase Edge Functions

Además de configurar las variables en la API externa, también debes configurarlas en las variables de entorno de Supabase:

1. Ve a tu proyecto en Supabase
2. Navega a **Settings → Edge Functions**
3. En la sección **Environment Variables**, agrega:

```bash
MERCADOPAGO_ACCESS_TOKEN=tu_access_token_aqui
MERCADOPAGO_BACK_URL=https://tu-dominio.com/suscripcion-exitosa
MERCADOPAGO_API_URL=https://api.mercadopago.com/preapproval_plan
```

## Uso del Sistema

### 1. Crear un Plan
1. En el Dashboard, ve a la sección **Planes**
2. Click en **Nuevo Plan**
3. Completa la información:
   - Nombre: "Plan Premium"
   - Descripción: "Acceso completo a todas las funcionalidades"
   - Precio: 1200
   - Moneda: UYU
   - Ciclo: monthly o annual
   - Días de prueba: 30 (opcional)
   - Funcionalidades: Selecciona del catálogo

4. Click en **Crear Plan**

### 2. Sincronizar con MercadoPago
1. Ve a **Aplicaciones** y selecciona una aplicación
2. Click en **Ver Planes**
3. Localiza el plan que deseas sincronizar
4. Click en **Sincronizar con MP**

**Qué sucede al sincronizar:**
- El sistema envía el plan a MercadoPago
- MercadoPago crea un plan de suscripción recurrente
- El sistema guarda:
  - `mp_preapproval_plan_id`: ID del plan en MercadoPago
  - `mp_init_point`: URL de checkout para suscribirse
  - `mp_back_url`: URL de retorno
  - `mp_status`: Estado del plan (active)

### 3. Usar el Plan en tu Aplicación

Una vez sincronizado, tu aplicación puede obtener el `mp_init_point` a través de la API de validación:

```bash
POST /validation-api/validate-user
{
  "external_user_id": "user123",
  "external_app_id": "APP_001"
}
```

**Respuesta incluye:**
```json
{
  "success": true,
  "subscription": {
    "mp_init_point": "https://www.mercadopago.com.uy/subscriptions/checkout?preapproval_plan_id=...",
    "mp_back_url": "https://tu-dominio.com/suscripcion-exitosa",
    ...
  },
  "available_plans": [
    {
      "id": "plan-uuid",
      "name": "Plan Premium",
      "mp_init_point": "https://www.mercadopago.com.uy/...",
      ...
    }
  ]
}
```

### 4. Redirigir al Usuario para Pagar

En tu aplicación frontend:
```javascript
// Obtener el init_point de la respuesta
const initPoint = response.subscription.mp_init_point;

// Redirigir al usuario
window.location.href = initPoint;
```

El usuario será dirigido al checkout de MercadoPago donde podrá:
- Ver los detalles del plan
- Ingresar información de pago
- Completar la suscripción

Después del pago, MercadoPago redirigirá al usuario a tu `MERCADOPAGO_BACK_URL`.

## Estructura del Payload Enviado a MercadoPago

Cuando sincronizas un plan, el sistema construye y envía este payload:

```json
{
  "reason": "Plan Premium",
  "auto_recurring": {
    "frequency": 1,
    "frequency_type": "months",
    "repetitions": 12,
    "billing_day": 10,
    "billing_day_proportional": true,
    "free_trial": {
      "frequency": 30,
      "frequency_type": "days"
    },
    "transaction_amount": 1200,
    "currency_id": "UYU"
  },
  "payment_methods_allowed": {
    "payment_types": [{}],
    "payment_methods": [{}]
  },
  "back_url": "https://tu-dominio.com/suscripcion-exitosa"
}
```

### Mapeo de Billing Cycle

- **monthly**: `frequency: 1`, `frequency_type: "months"`, `repetitions: 12`
- **annual**: `frequency: 12`, `frequency_type: "months"`, `repetitions: 1`

### Free Trial

Si el plan tiene `trial_days`:
- **< 30 días**: Se envía en días (`frequency: trial_days`, `frequency_type: "days"`)
- **≥ 30 días**: Se convierte a meses (`frequency: Math.floor(trial_days/30)`, `frequency_type: "months"`)

## Verificación de Configuración

Para verificar que MercadoPago está configurado correctamente:

1. Abre la consola del navegador en el Dashboard
2. Ejecuta:
```javascript
await ConfigService.getConfig();
console.log('MP Configured:', ConfigService.isMercadoPagoConfigured());
console.log('MP Token:', ConfigService.getMercadoPagoAccessToken());
console.log('MP Back URL:', ConfigService.getMercadoPagoBackUrl());
```

3. Si `isMercadoPagoConfigured()` retorna `true`, estás listo para sincronizar planes.

## Troubleshooting

### Error: "MercadoPago no está configurado"
**Causa:** No se encontró el token de acceso o está configurado con el valor por defecto.

**Solución:**
1. Verifica que agregaste `MERCADOPAGO_ACCESS_TOKEN` en tu API de configuración
2. Asegúrate de que el valor no sea `your_mercadopago_access_token_here`
3. Refresca la configuración en el Dashboard

### Error: "MercadoPago API error: 401"
**Causa:** Token de acceso inválido o expirado.

**Solución:**
1. Verifica que estás usando el token correcto de MercadoPago
2. Asegúrate de usar el token de producción en producción y el de pruebas en desarrollo
3. Genera un nuevo token si es necesario

### Error: "Failed to sync with MercadoPago"
**Causa:** Error al comunicarse con la API de MercadoPago.

**Solución:**
1. Verifica tu conexión a internet
2. Comprueba que la URL de la API es correcta
3. Revisa los logs de Supabase Edge Functions para más detalles

### El plan se sincronizó pero no aparece el botón
**Causa:** El frontend no se actualizó después de la sincronización.

**Solución:**
1. Cierra y vuelve a abrir el modal de planes
2. Refresca la página del Dashboard
3. Verifica que `mp_preapproval_plan_id` esté guardado en la base de datos

## Seguridad

### Protección del Access Token
- **Nunca** expongas tu Access Token en el código frontend
- Las variables se obtienen desde la API de configuración externa
- El token se usa solo en las Edge Functions del backend
- Usa credenciales de prueba en desarrollo
- Rota el token regularmente en producción

### Validación de Webhooks
Para producción, considera implementar webhooks de MercadoPago para:
- Confirmar pagos en tiempo real
- Actualizar el estado de suscripciones
- Manejar cancelaciones y renovaciones

## Recursos Adicionales

- [Documentación de MercadoPago - Suscripciones](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/integration-configuration/subscription-creation)
- [API Reference - Preapproval Plans](https://www.mercadopago.com.ar/developers/es/reference/subscriptions/_preapproval_plan/post)
- [Credenciales de MercadoPago](https://www.mercadopago.com.ar/developers/panel/credentials)
- [Testing con MercadoPago](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/testing)

## Soporte

Si tienes problemas con la configuración:
1. Revisa los logs de Supabase Edge Functions
2. Verifica la consola del navegador para errores
3. Comprueba que todas las variables estén configuradas correctamente
4. Contacta al equipo de soporte técnico
