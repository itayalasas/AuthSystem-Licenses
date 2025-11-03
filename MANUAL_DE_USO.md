# 📖 Manual de Uso - Sistema de Licencias Multi-Aplicación

## 🎯 ¿Qué es este sistema?

Este es un **sistema centralizado de gestión de licencias y suscripciones** que permite:

1. **Administrar múltiples aplicaciones** desde un solo lugar
2. **Crear clientes (tenants)** que pueden usar tus aplicaciones
3. **Asignar planes y licencias** a cada cliente
4. **Controlar el acceso** de los clientes a las funcionalidades de tus aplicaciones

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    PANEL DE ADMINISTRACIÓN                   │
│              (Lo que estás viendo ahora)                     │
│                                                              │
│  • Crear clientes                                           │
│  • Asignar aplicaciones                                     │
│  • Gestionar suscripciones                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      BASE DE DATOS                           │
│                                                              │
│  • applications (tus apps)                                  │
│  • tenants (tus clientes)                                   │
│  • plans (planes de suscripción)                            │
│  • subscriptions (licencias activas)                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   TUS APLICACIONES                           │
│                                                              │
│  • Se conectan al sistema                                   │
│  • Verifican licencias                                      │
│  • Controlan funcionalidades                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Conceptos Clave

### 🔷 **Application (Aplicación)**
Una aplicación que desarrollaste y quieres licenciar.

**Ejemplo:** "Mi Sistema de Facturación", "Mi CRM", "Mi ERP"

### 🔷 **Tenant (Cliente)**
Una empresa o persona que usa tus aplicaciones.

**Ejemplo:** "Empresa ABC S.A.", "Juan Pérez"

### 🔷 **Plan**
Un nivel de servicio con funcionalidades específicas.

**Ejemplo:**
- Plan Básico: $10/mes, 5 usuarios
- Plan Pro: $50/mes, 50 usuarios, reportes avanzados
- Plan Enterprise: $200/mes, usuarios ilimitados, API

### 🔷 **Subscription (Suscripción/Licencia)**
La relación entre un Cliente, una Aplicación y un Plan.

**Ejemplo:** "Empresa ABC tiene el Plan Pro de Mi CRM hasta el 31/12/2025"

---

## 🚀 Guía Paso a Paso

### **PASO 1: Registrar tu Aplicación**

Primero debes registrar cada aplicación que quieres licenciar.

#### Datos necesarios:
- **Nombre**: Nombre de tu aplicación
- **Slug**: identificador único (ej: `mi-crm`, `mi-erp`)
- **External App ID**: ID único para integración (ej: `app_001`)
- **Webhook URL**: (Opcional) URL para notificaciones

#### ¿Cómo hacerlo?

**Opción A: Desde el Dashboard**
1. Ve a la sección "Aplicaciones"
2. Click en "Nueva Aplicación"
3. Completa el formulario
4. Guarda el `API Key` que se genera

**Opción B: Por API**
```bash
curl -X POST "https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/admin-api/applications" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: admin_001" \
  -d '{
    "name": "Mi Sistema CRM",
    "slug": "mi-crm",
    "external_app_id": "app_crm_001",
    "webhook_url": "https://mi-app.com/webhook"
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-de-la-app",
    "api_key": "ak_xxxxxxxxxxx",  // ⚠️ GUARDA ESTO
    "name": "Mi Sistema CRM"
  }
}
```

---

### **PASO 2: Crear Planes de Suscripción**

Los planes definen qué funcionalidades y límites tiene cada nivel.

#### Ejemplo de estructura:

```json
{
  "name": "Plan Profesional",
  "price": 49.99,
  "currency": "USD",
  "billing_cycle": "monthly",
  "trial_days": 14,
  "entitlements": {
    "max_users": 50,
    "max_storage_gb": 100,
    "features": {
      "advanced_reports": true,
      "api_access": true,
      "custom_branding": false,
      "priority_support": true
    }
  }
}
```

#### ¿Cómo crear planes?

Por ahora, los planes se crean **directamente en la base de datos**:

```sql
INSERT INTO plans (
  application_id,
  name,
  description,
  price,
  currency,
  billing_cycle,
  trial_days,
  entitlements
) VALUES (
  'uuid-de-tu-aplicacion',
  'Plan Profesional',
  'Perfecto para pequeñas empresas',
  49.99,
  'USD',
  'monthly',
  14,
  '{"max_users": 50, "features": {"advanced_reports": true}}'::jsonb
);
```

---

### **PASO 3: Crear un Cliente (Tenant)**

Un cliente es quien va a usar tu aplicación.

#### Desde el Dashboard:
1. Click en "Crear Nuevo Cliente"
2. Completa el formulario:
   - **Nombre del Cliente**: Pedro Ayala
   - **Nombre de la Organización**: Ayala IT S.A.S
   - **ID de Usuario Propietario**: 123 (tu ID interno)
   - **Email del Propietario**: pedro.ayala@ayalait.com.uy
   - **Email de Facturación**: facturacion@ayalait.com.uy
   - **Dominio**: ayalait.com.uy
3. Click en "Crear Cliente"

#### Por API:
```bash
curl -X POST "https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/admin-api/tenants" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: admin_001" \
  -d '{
    "name": "Pedro Ayala",
    "organization_name": "Ayala IT S.A.S",
    "owner_user_id": "123",
    "owner_email": "pedro.ayala@ayalait.com.uy",
    "billing_email": "facturacion@ayalait.com.uy",
    "domain": "ayalait.com.uy"
  }'
```

---

### **PASO 4: Asignar una Licencia al Cliente**

Este es el paso donde le das acceso a tu aplicación con un plan específico.

#### Desde el Dashboard:
1. Ve a la lista de clientes
2. Selecciona el cliente
3. Click en "Asignar Aplicación"
4. Selecciona:
   - La aplicación
   - El plan
   - Si quieres iniciar con periodo de prueba
5. Click en "Asignar"

#### Por API:
```bash
curl -X POST "https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/admin-api/tenants/{tenant_id}/grant-access" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: admin_001" \
  -d '{
    "application_id": "uuid-de-la-aplicacion",
    "plan_id": "uuid-del-plan",
    "start_trial": true,
    "notes": "Cliente nuevo - periodo de prueba 14 días"
  }'
```

**¿Qué sucede internamente?**
1. Se crea una suscripción (subscription)
2. Se vincula el cliente con la aplicación (tenant_applications)
3. Se establece la fecha de inicio y fin
4. Si es trial, se calculan las fechas del periodo de prueba

---

### **PASO 5: Integrar tu Aplicación**

Ahora tu aplicación necesita verificar las licencias.

#### En el código de tu aplicación:

```typescript
// 1. Instala el cliente
npm install @supabase/supabase-js

// 2. Configura la conexión
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://yamuegahohdfyfxwobrk.supabase.co',
  'tu-api-key-de-la-aplicacion'
)

// 3. Verifica la licencia del usuario
async function verificarLicencia(userId: string, appId: string) {
  const response = await fetch(
    `https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/validation-api/validate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': 'tu-api-key-de-la-aplicacion'
      },
      body: JSON.stringify({
        user_id: userId,
        app_id: appId
      })
    }
  )

  const result = await response.json()

  if (result.valid) {
    console.log('Licencia válida!')
    console.log('Plan:', result.subscription.plan.name)
    console.log('Expira:', result.subscription.period_end)
    console.log('Funcionalidades:', result.entitlements)

    // Permitir acceso
    return true
  } else {
    console.log('Sin licencia válida:', result.reason)

    // Bloquear acceso
    return false
  }
}

// 4. Verificar funcionalidad específica
async function puedeUsarReportesAvanzados(userId: string) {
  const result = await verificarLicencia(userId, 'app_001')

  if (result.valid) {
    return result.entitlements.features.advanced_reports === true
  }

  return false
}
```

#### Ejemplo de uso en React:

```tsx
import { useEffect, useState } from 'react'

function MiComponente() {
  const [licenciaValida, setLicenciaValida] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function verificar() {
      const valida = await verificarLicencia('user_123', 'app_001')
      setLicenciaValida(valida)
      setCargando(false)
    }

    verificar()
  }, [])

  if (cargando) {
    return <div>Verificando licencia...</div>
  }

  if (!licenciaValida) {
    return (
      <div>
        <h1>Acceso Denegado</h1>
        <p>Tu licencia ha expirado. Contacta a soporte.</p>
      </div>
    )
  }

  return (
    <div>
      <h1>¡Bienvenido!</h1>
      <p>Tu licencia está activa</p>
    </div>
  )
}
```

---

## 🔄 Ciclo de Vida de una Licencia

### Estados de Suscripción:

1. **`trialing`** - Periodo de prueba activo
2. **`active`** - Suscripción pagada y activa
3. **`past_due`** - Pago pendiente
4. **`canceled`** - Cancelada por admin o cliente
5. **`expired`** - Periodo terminado

### Flujo típico:

```
NUEVO CLIENTE
    │
    ├──► [trialing] 14 días gratis
    │         │
    │         ├──► Cliente paga ──► [active]
    │         │
    │         └──► No paga ──► [expired]
    │
    └──► Sin trial ──► [active] (si paga) o [canceled]

[active]
    │
    ├──► Renueva pago ──► [active] (nuevo periodo)
    │
    ├──► No paga ──► [past_due] ──► [expired]
    │
    └──► Cancela ──► [canceled]
```

---

## 🛠️ Casos de Uso Comunes

### **Caso 1: Cliente nuevo con periodo de prueba**

1. Crear el tenant (cliente)
2. Asignar aplicación con `start_trial: true`
3. El cliente tiene 14 días (configurable) de acceso completo
4. Antes de que expire, procesar el pago
5. Cambiar el estado de `trialing` a `active`

### **Caso 2: Upgrade de plan**

```bash
curl -X PUT "https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/admin-api/subscriptions/{subscription_id}/change-plan" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: admin_001" \
  -d '{
    "plan_id": "uuid-del-nuevo-plan"
  }'
```

### **Caso 3: Suspender cliente por falta de pago**

```bash
curl -X PUT "https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/admin-api/subscriptions/{subscription_id}/status" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: admin_001" \
  -d '{
    "status": "past_due"
  }'
```

### **Caso 4: Cancelar acceso completamente**

```bash
curl -X PUT "https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/admin-api/tenants/{tenant_id}/revoke-access/{app_id}" \
  -H "X-Admin-Token: admin_001"
```

---

## 📊 Consultar Información

### Ver todos los clientes:
```bash
curl "https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/admin-api/tenants" \
  -H "X-Admin-Token: admin_001"
```

### Ver un cliente específico:
```bash
curl "https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/admin-api/tenants/{tenant_id}" \
  -H "X-Admin-Token: admin_001"
```

### Ver estadísticas:
```bash
curl "https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/admin-api/stats" \
  -H "X-Admin-Token: admin_001"
```

---

## 🔐 Seguridad

### Token de Admin
- **Token actual**: `admin_001`
- Úsalo solo en el backend
- Nunca lo expongas en el frontend
- Permite acceso completo al sistema

### API Keys de Aplicaciones
- Cada aplicación tiene su propia API Key
- Se genera automáticamente al crear la app
- Se usa para validar licencias
- Puede exponerse en el frontend (es segura)

### Row Level Security (RLS)
- Todas las tablas tienen RLS activado
- Los clientes solo ven sus propios datos
- Los admins pueden ver todo

---

## 🎨 Personalización

### Agregar funcionalidades personalizadas:

En la tabla `plans`, el campo `entitlements` es flexible:

```json
{
  "max_users": 100,
  "max_storage_gb": 500,
  "max_api_calls_per_day": 10000,
  "features": {
    "advanced_reports": true,
    "custom_branding": true,
    "api_access": true,
    "webhooks": true,
    "sso": false,
    "white_label": false
  },
  "modules": {
    "invoicing": true,
    "inventory": true,
    "crm": true,
    "accounting": false
  }
}
```

En tu aplicación, verifica estas funcionalidades:

```typescript
if (licencia.entitlements.modules.invoicing) {
  // Mostrar módulo de facturación
}

if (licencia.entitlements.features.white_label) {
  // Permitir personalización de marca
}
```

---

## 📞 Webhooks (Opcional)

Si configuraste una webhook URL, recibirás notificaciones cuando:

- Se crea una nueva suscripción
- Cambia el estado de una suscripción
- Se cancela una suscripción
- Expira un periodo de prueba

**Formato del webhook:**
```json
{
  "event": "subscription.created",
  "timestamp": "2025-11-03T20:00:00Z",
  "data": {
    "subscription_id": "uuid",
    "tenant_id": "uuid",
    "application_id": "uuid",
    "plan_id": "uuid",
    "status": "active"
  }
}
```

---

## ❓ Preguntas Frecuentes

### **P: ¿Puedo tener múltiples aplicaciones?**
R: Sí, puedes registrar tantas aplicaciones como necesites.

### **P: ¿Un cliente puede tener acceso a varias aplicaciones?**
R: Sí, un tenant puede tener múltiples suscripciones, una por cada aplicación.

### **P: ¿Cómo cobro a mis clientes?**
R: Este sistema NO procesa pagos. Debes integrar tu propio sistema de pagos (Stripe, PayPal, etc.) y luego actualizar los estados de las suscripciones vía API.

### **P: ¿Qué pasa si un cliente no paga?**
R: Debes cambiar el estado de la suscripción a `past_due` o `expired`. La aplicación bloqueará el acceso automáticamente.

### **P: ¿Puedo dar acceso gratis a un cliente?**
R: Sí, crea un plan con precio $0 o marca la suscripción como cortesía.

### **P: ¿Cómo manejo renovaciones?**
R: Cuando proceses el pago exitoso, actualiza:
- `period_start` a la fecha actual
- `period_end` a la nueva fecha de expiración
- `status` a `active`

---

## 🚦 Próximos Pasos

1. ✅ **Crea tu primera aplicación**
2. ✅ **Define tus planes**
3. ✅ **Crea un cliente de prueba**
4. ✅ **Asígnale una licencia**
5. ✅ **Integra la validación en tu app**
6. ✅ **Prueba el acceso**

---

## 📚 Recursos Adicionales

- **Base de datos Supabase**: https://yamuegahohdfyfxwobrk.supabase.co
- **API Admin**: `/functions/v1/admin-api`
- **API Validación**: `/functions/v1/validation-api`
- **Token Admin**: `admin_001`

---

## 💡 Ejemplo Completo

```typescript
// === EN TU APLICACIÓN ===

// 1. Configuración inicial
const SUPABASE_URL = 'https://yamuegahohdfyfxwobrk.supabase.co'
const APP_API_KEY = 'tu-api-key'  // La que obtuviste al crear la app

// 2. Función para verificar acceso
async function verificarAcceso(userId: string) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/validation-api/validate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': APP_API_KEY
      },
      body: JSON.stringify({
        user_id: userId,
        app_id: 'tu-app-id'
      })
    }
  )

  return await response.json()
}

// 3. Proteger rutas
app.get('/dashboard', async (req, res) => {
  const userId = req.user.id
  const licencia = await verificarAcceso(userId)

  if (!licencia.valid) {
    return res.redirect('/sin-acceso')
  }

  res.render('dashboard', {
    plan: licencia.subscription.plan.name,
    expira: licencia.subscription.period_end
  })
})

// 4. Controlar funcionalidades
app.get('/api/reportes-avanzados', async (req, res) => {
  const userId = req.user.id
  const licencia = await verificarAcceso(userId)

  if (!licencia.valid || !licencia.entitlements.features.advanced_reports) {
    return res.status(403).json({
      error: 'Esta funcionalidad requiere el Plan Pro'
    })
  }

  // Generar reportes avanzados...
  res.json({ reportes: [...] })
})
```

---

¿Necesitas ayuda? Consulta este manual o contacta a soporte técnico.
