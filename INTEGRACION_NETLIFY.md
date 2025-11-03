# Guía de Integración: Provisión Automática de Tenants con Netlify

## Resumen del Sistema

Este sistema permite que cuando un usuario se registra en tu aplicación, automáticamente:
1. Se crea un **tenant** (cliente) en la base de datos
2. Se le asigna un **subdominio único** (ej: `acmecorp-abc123.netlify.app`)
3. Se le da acceso a la aplicación con un **plan trial**
4. Se genera una **licencia** para validar acceso y features

## Flujo de Onboarding Completo

```
Usuario se registra en tu app
        ↓
Tu backend autentica al usuario
        ↓
Llamas a Edge Function: tenant-onboarding
        ↓
Sistema crea tenant + subdominio + suscripción trial
        ↓
Retorna datos del tenant y subdomain
        ↓
Tu app redirige al usuario a su subdominio
        ↓
Usuario accede a su instancia personalizada
```

## 1. Llamada desde Tu Aplicación

### Ejemplo: Después del Registro

```javascript
// Después de crear el usuario en tu sistema de autenticación
async function onboardNewUser(user) {
  const response = await fetch(
    'https://tu-proyecto.supabase.co/functions/v1/tenant-onboarding',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        application_id: 'app_51ecb9e2-6b3', // ID de tu app (CommHub, etc.)
        user_id: user.id, // ID del usuario en tu sistema
        email: user.email,
        name: user.name || user.email.split('@')[0],
        company_name: user.company_name, // Opcional
        subdomain: 'mi-empresa', // Opcional - si no se proporciona, se genera automáticamente
        plan_id: 'uuid-del-plan', // Opcional - si no se proporciona, usa el plan Free
        start_trial: true, // Por defecto true
      }),
    }
  );

  const result = await response.json();

  if (result.success) {
    // Tenant creado exitosamente
    const { tenant, subscription, netlify_info } = result;

    console.log('Tenant ID:', tenant.id);
    console.log('Subdominio:', netlify_info.subdomain);
    console.log('URL:', netlify_info.url);
    console.log('Plan:', subscription.plan.name);
    console.log('Trial termina:', subscription.trial_end);

    // Redirigir al usuario a su subdominio
    window.location.href = netlify_info.url;
  } else {
    console.error('Error:', result.error);
  }
}
```

## 2. Configuración en Netlify

### Opción A: Usar Subdominios de Netlify (Más Fácil)

El sistema ya genera automáticamente un subdominio como: `acmecorp-abc123.netlify.app`

**No necesitas configuración adicional** - Netlify lo maneja automáticamente.

### Opción B: Usar Tu Propio Dominio (Recomendado para Producción)

Si quieres usar subdominios de tu propio dominio (ej: `acmecorp.tuapp.com`):

#### Paso 1: Wildcard DNS en tu Proveedor de DNS

Agrega un registro DNS wildcard en tu proveedor (Cloudflare, Route53, etc.):

```
Tipo: CNAME
Nombre: *
Valor: tu-app.netlify.app
TTL: 3600
```

Esto hace que cualquier subdominio (cliente1.tuapp.com, cliente2.tuapp.com) apunte a Netlify.

#### Paso 2: Configurar en Netlify

1. Ve a tu proyecto en Netlify
2. **Site settings** → **Domain management**
3. Click en **Add domain alias**
4. Agregar: `*.tuapp.com`
5. Netlify verificará la propiedad del dominio
6. Automáticamente provisionará certificados SSL para todos los subdominios

#### Paso 3: Actualizar el Edge Function

Modifica en `tenant-onboarding/index.ts` línea 90:

```typescript
domain: `${tenantSubdomain}.tuapp.com`, // Cambiar de .netlify.app a tu dominio
```

## 3. Detectar Tenant por Subdominio en Tu App

Tu aplicación necesita saber qué tenant está accediendo según el subdominio:

```javascript
// En tu aplicación (Frontend)
function getCurrentTenant() {
  const hostname = window.location.hostname;

  // Extrae el subdominio
  // Ej: acmecorp.tuapp.com → acmecorp
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    const subdomain = parts[0];
    return subdomain;
  }

  // Si es el dominio principal, no hay tenant
  return null;
}

// Luego valida el acceso
async function validateAccess() {
  const subdomain = getCurrentTenant();

  if (!subdomain) {
    // Usuario en página principal - mostrar landing/login
    return;
  }

  // Buscar tenant por subdomain
  const apiKey = 'tu_app_api_key'; // De la tabla applications

  const response = await fetch(
    `https://tu-proyecto.supabase.co/functions/v1/validation-api/validate-user`,
    {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        external_user_id: currentUser.id, // Usuario autenticado
      })
    }
  );

  const result = await response.json();

  if (result.has_access) {
    // Verificar que el tenant del usuario coincide con el subdomain
    const tenantSubdomain = result.tenant.metadata.subdomain;

    if (tenantSubdomain === subdomain) {
      // Acceso válido - cargar app
      return result;
    } else {
      // Usuario intentando acceder a otro tenant
      window.location.href = `https://${tenantSubdomain}.tuapp.com`;
    }
  } else {
    // Sin acceso - mostrar mensaje
    alert('No tienes acceso a esta aplicación');
  }
}
```

## 4. Arquitectura Multi-Tenant

### Opción A: Single App con Lógica de Tenant (Más Simple)

Una sola aplicación en Netlify que detecta el subdomain y carga los datos del tenant correspondiente.

```
cliente1.tuapp.com ─┐
cliente2.tuapp.com ─┼─→ Misma App en Netlify
cliente3.tuapp.com ─┘    (Filtra datos por tenant_id)
```

**Ventajas:**
- Una sola aplicación para mantener
- Un solo deploy
- Más fácil de gestionar

**Implementación:**
- Tu app React/Vue/Svelte detecta el subdomain
- Hace queries a Supabase filtrando por `tenant_id`
- RLS policies en Supabase aseguran que cada tenant solo ve sus datos

### Opción B: Múltiples Sites en Netlify (Aislamiento Completo)

Creas un nuevo site en Netlify por cada tenant (usando Netlify API).

**Ventajas:**
- Aislamiento total entre tenants
- Configuraciones personalizadas por tenant

**Desventajas:**
- Más complejo de gestionar
- Necesitas automatizar creación de sites

## 5. Ejemplo Completo: React App

```javascript
// src/App.jsx
import { useEffect, useState } from 'react';

function App() {
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeApp();
  }, []);

  async function initializeApp() {
    // 1. Detectar subdomain
    const subdomain = window.location.hostname.split('.')[0];

    // 2. Si no hay subdomain, mostrar landing page
    if (subdomain === 'www' || subdomain === 'tuapp') {
      setLoading(false);
      return;
    }

    // 3. Validar acceso del usuario
    const currentUser = getCurrentUser(); // Tu función de auth

    if (!currentUser) {
      // Redirigir a login
      window.location.href = `https://tuapp.com/login?redirect=${subdomain}`;
      return;
    }

    // 4. Validar que el usuario tiene acceso a este tenant
    const apiKey = 'tu_api_key_de_applications';

    const response = await fetch(
      'https://tu-proyecto.supabase.co/functions/v1/validation-api/validate-user',
      {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          external_user_id: currentUser.id,
        })
      }
    );

    const result = await response.json();

    if (result.has_access) {
      const tenantSubdomain = result.tenant.metadata.subdomain;

      if (tenantSubdomain === subdomain) {
        // Todo OK - cargar app
        setTenant(result.tenant);
        setLoading(false);
      } else {
        // Redirigir al subdomain correcto del usuario
        window.location.href = `https://${tenantSubdomain}.tuapp.com`;
      }
    } else {
      alert('No tienes acceso a esta aplicación');
      window.location.href = 'https://tuapp.com';
    }
  }

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (!tenant) {
    return <LandingPage />;
  }

  return (
    <div>
      <h1>Bienvenido a {tenant.name}</h1>
      <p>Subdomain: {tenant.metadata.subdomain}</p>
      {/* Tu app aquí */}
    </div>
  );
}
```

## 6. Variables de Entorno

Configura en Netlify:

```bash
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
VITE_APP_ID=app_51ecb9e2-6b3
VITE_APP_API_KEY=tu_api_key_de_applications
```

## 7. Netlify Functions (Opcional)

Si necesitas lógica server-side, puedes crear Netlify Functions:

```javascript
// netlify/functions/get-tenant.js
exports.handler = async (event) => {
  const hostname = event.headers.host;
  const subdomain = hostname.split('.')[0];

  // Buscar tenant en Supabase
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/tenants?metadata->>subdomain=eq.${subdomain}`,
    {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      }
    }
  );

  const tenants = await response.json();

  return {
    statusCode: 200,
    body: JSON.stringify({ tenant: tenants[0] || null }),
  };
};
```

## 8. Testing

### Desarrollo Local

Usa herramientas como `localhost.run` o edita tu archivo `/etc/hosts`:

```
127.0.0.1 cliente1.localhost
127.0.0.1 cliente2.localhost
```

Luego corre tu app en modo dev y accede a `http://cliente1.localhost:5173`

## Resumen de Decisiones

| Aspecto | Opción Recomendada | Por qué |
|---------|-------------------|---------|
| **Subdominios** | Tu propio dominio con wildcard | Más profesional, tu marca |
| **Arquitectura** | Single app con lógica multi-tenant | Más simple, menos costos |
| **Provisioning** | Automático en registro | Mejor UX |
| **Validación** | Por subdomain + user_id | Seguro y flexible |

¿Necesitas ayuda con alguna parte específica de la integración?
