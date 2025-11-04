# 🔧 Guía de Integración para Desarrolladores

Esta guía explica cómo integrar el sistema de licencias en tus aplicaciones cliente.

## 📋 Índice

1. [Requisitos Previos](#requisitos-previos)
2. [Configuración Inicial](#configuración-inicial)
3. [Validación de Licencias](#validación-de-licencias)
4. [Ejemplos de Uso](#ejemplos-de-uso)
5. [Estados de Suscripción](#estados-de-suscripción)
6. [Manejo de Errores](#manejo-de-errores)
7. [Buenas Prácticas](#buenas-prácticas)

---

## Requisitos Previos

Antes de integrar el sistema de licencias, asegúrate de:

1. **Tener tu aplicación registrada** en el sistema
   - Obtén tu `API Key` desde el Dashboard
   - Guarda el `External App ID` de tu aplicación

2. **Tener planes creados** para tu aplicación
   - Define los límites y funcionalidades de cada plan
   - Configura los periodos de prueba si los deseas

3. **Tener clientes registrados** con acceso a tu aplicación
   - Los clientes deben tener una suscripción activa o en prueba

---

## Configuración Inicial

### 1. Variables de Entorno

Crea un archivo `.env` en tu aplicación:

\`\`\`env
# URL de Supabase
VITE_SUPABASE_URL=https://yamuegahohdfyfxwobrk.supabase.co

# API Key de tu aplicación (NO ES LA ANON KEY DE SUPABASE)
VITE_APP_API_KEY=ak_xxxxxxxxxxxxxx

# ID externo de tu aplicación
VITE_APP_ID=app_001
\`\`\`

### 2. Instalar Dependencias

\`\`\`bash
npm install @supabase/supabase-js
\`\`\`

---

## Validación de Licencias

### API Endpoint

\`\`\`
POST https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/validation-api/validate-user
\`\`\`

### Headers Requeridos

\`\`\`
Content-Type: application/json
X-API-Key: <tu-api-key-de-aplicacion>
\`\`\`

### Request Body

\`\`\`json
{
  "external_user_id": "user_123",  // O usar user_email
  "user_email": "usuario@ejemplo.com"
}
\`\`\`

### Response Exitoso

\`\`\`json
{
  "success": true,
  "has_access": true,
  "tenant": {
    "id": "uuid",
    "name": "Empresa ABC",
    "status": "active"
  },
  "subscription": {
    "id": "uuid",
    "status": "active",
    "period_start": "2025-01-01T00:00:00Z",
    "period_end": "2025-02-01T00:00:00Z",
    "plan": {
      "id": "uuid",
      "name": "Plan Profesional",
      "entitlements": {
        "max_users": 50,
        "max_storage_gb": 100,
        "features": {
          "advanced_reports": true,
          "api_access": true,
          "custom_branding": false
        }
      }
    }
  }
}
\`\`\`

### Response Sin Acceso

\`\`\`json
{
  "success": true,
  "has_access": false,
  "message": "User does not have access to this application"
}
\`\`\`

---

## Ejemplos de Uso

### JavaScript Puro

\`\`\`javascript
// license-validator.js
class LicenseValidator {
  constructor(apiKey, supabaseUrl) {
    this.apiKey = apiKey;
    this.supabaseUrl = supabaseUrl;
  }

  async validateUser(userId, userEmail) {
    try {
      const response = await fetch(
        \`\${this.supabaseUrl}/functions/v1/validation-api/validate-user\`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
          },
          body: JSON.stringify({
            external_user_id: userId,
            user_email: userEmail,
          }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Validation failed');
      }

      return result;
    } catch (error) {
      console.error('License validation error:', error);
      return {
        success: false,
        has_access: false,
        error: error.message,
      };
    }
  }

  async hasFeature(userId, featureName) {
    const validation = await this.validateUser(userId);

    if (!validation.has_access) {
      return false;
    }

    const features = validation.subscription?.plan?.entitlements?.features || {};
    return features[featureName] === true;
  }

  async getLimit(userId, limitName) {
    const validation = await this.validateUser(userId);

    if (!validation.has_access) {
      return 0;
    }

    const entitlements = validation.subscription?.plan?.entitlements || {};
    return entitlements[limitName] || 0;
  }
}

// Uso
const validator = new LicenseValidator(
  process.env.VITE_APP_API_KEY,
  process.env.VITE_SUPABASE_URL
);

// Validar usuario
const result = await validator.validateUser('user_123');
console.log('Tiene acceso:', result.has_access);

// Verificar funcionalidad específica
const hasReports = await validator.hasFeature('user_123', 'advanced_reports');
console.log('Puede usar reportes avanzados:', hasReports);

// Obtener límite
const maxUsers = await validator.getLimit('user_123', 'max_users');
console.log('Máximo de usuarios permitidos:', maxUsers);
\`\`\`

### React Hook

\`\`\`typescript
// hooks/useLicense.ts
import { useState, useEffect } from 'react';

interface LicenseData {
  hasAccess: boolean;
  loading: boolean;
  error: string | null;
  subscription: any;
  entitlements: any;
}

export function useLicense(userId: string) {
  const [license, setLicense] = useState<LicenseData>({
    hasAccess: false,
    loading: true,
    error: null,
    subscription: null,
    entitlements: null,
  });

  useEffect(() => {
    let mounted = true;

    async function validateLicense() {
      try {
        const response = await fetch(
          \`\${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validation-api/validate-user\`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': import.meta.env.VITE_APP_API_KEY,
            },
            body: JSON.stringify({
              external_user_id: userId,
            }),
          }
        );

        const result = await response.json();

        if (mounted) {
          if (result.success && result.has_access) {
            setLicense({
              hasAccess: true,
              loading: false,
              error: null,
              subscription: result.subscription,
              entitlements: result.subscription?.plan?.entitlements || {},
            });
          } else {
            setLicense({
              hasAccess: false,
              loading: false,
              error: result.message || 'No access',
              subscription: null,
              entitlements: null,
            });
          }
        }
      } catch (error) {
        if (mounted) {
          setLicense({
            hasAccess: false,
            loading: false,
            error: error.message,
            subscription: null,
            entitlements: null,
          });
        }
      }
    }

    validateLicense();

    return () => {
      mounted = false;
    };
  }, [userId]);

  return license;
}

// hooks/useFeature.ts
export function useFeature(userId: string, featureName: string) {
  const license = useLicense(userId);
  const hasFeature = license.entitlements?.features?.[featureName] === true;

  return {
    hasFeature,
    loading: license.loading,
  };
}
\`\`\`

### Uso en Componente React

\`\`\`tsx
// components/ProtectedFeature.tsx
import { useLicense, useFeature } from '../hooks/useLicense';

function Dashboard({ userId }) {
  const license = useLicense(userId);

  if (license.loading) {
    return <div>Verificando licencia...</div>;
  }

  if (!license.hasAccess) {
    return (
      <div className="alert alert-error">
        <h2>Acceso Denegado</h2>
        <p>Tu suscripción ha expirado o no tienes acceso a esta aplicación.</p>
        <button>Contactar Soporte</button>
      </div>
    );
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Plan: {license.subscription.plan.name}</p>
      <p>Usuarios permitidos: {license.entitlements.max_users}</p>
    </div>
  );
}

// Proteger funcionalidad específica
function AdvancedReports({ userId }) {
  const { hasFeature, loading } = useFeature(userId, 'advanced_reports');

  if (loading) return <div>Cargando...</div>;

  if (!hasFeature) {
    return (
      <div className="alert alert-warning">
        <h3>Funcionalidad No Disponible</h3>
        <p>Los reportes avanzados solo están disponibles en el Plan Pro.</p>
        <button>Actualizar Plan</button>
      </div>
    );
  }

  return (
    <div>
      <h2>Reportes Avanzados</h2>
      {/* Contenido del feature */}
    </div>
  );
}
\`\`\`

### Vue.js Composable

\`\`\`typescript
// composables/useLicense.ts
import { ref, onMounted } from 'vue';

export function useLicense(userId: string) {
  const hasAccess = ref(false);
  const loading = ref(true);
  const error = ref(null);
  const subscription = ref(null);
  const entitlements = ref({});

  async function validateLicense() {
    try {
      const response = await fetch(
        \`\${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validation-api/validate-user\`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': import.meta.env.VITE_APP_API_KEY,
          },
          body: JSON.stringify({
            external_user_id: userId,
          }),
        }
      );

      const result = await response.json();

      if (result.success && result.has_access) {
        hasAccess.value = true;
        subscription.value = result.subscription;
        entitlements.value = result.subscription?.plan?.entitlements || {};
      } else {
        error.value = result.message || 'No access';
      }
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  }

  onMounted(() => {
    validateLicense();
  });

  return {
    hasAccess,
    loading,
    error,
    subscription,
    entitlements,
  };
}
\`\`\`

---

## Estados de Suscripción

| Estado | Descripción | Tiene Acceso |
|--------|-------------|--------------|
| \`trialing\` | Periodo de prueba activo | ✅ Sí |
| \`active\` | Suscripción pagada y activa | ✅ Sí |
| \`past_due\` | Pago pendiente | ⚠️ Depende (configurar período de gracia) |
| \`canceled\` | Cancelada por admin o usuario | ❌ No |
| \`expired\` | Periodo terminado | ❌ No |

### Manejo de Estados

\`\`\`javascript
function checkSubscriptionStatus(status) {
  switch (status) {
    case 'trialing':
      return {
        hasAccess: true,
        message: 'Periodo de prueba activo',
        warning: false,
      };

    case 'active':
      return {
        hasAccess: true,
        message: 'Suscripción activa',
        warning: false,
      };

    case 'past_due':
      return {
        hasAccess: true,  // Dar período de gracia
        message: 'Pago pendiente - Actualiza tu método de pago',
        warning: true,
      };

    case 'canceled':
    case 'expired':
      return {
        hasAccess: false,
        message: 'Suscripción inactiva - Contacta a soporte',
        warning: false,
      };

    default:
      return {
        hasAccess: false,
        message: 'Estado desconocido',
        warning: false,
      };
  }
}
\`\`\`

---

## Manejo de Errores

### Errores Comunes

\`\`\`javascript
async function validateWithErrorHandling(userId) {
  try {
    const response = await fetch(validationUrl, options);

    // Error de red
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('API Key inválida');
      }
      if (response.status === 404) {
        throw new Error('Usuario no encontrado');
      }
      if (response.status === 500) {
        throw new Error('Error del servidor');
      }
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Validation error:', error);

    // En caso de error, puedes decidir:
    // 1. Denegar acceso (más seguro)
    return { success: false, has_access: false };

    // 2. Permitir acceso temporal (mejor UX pero menos seguro)
    // return { success: true, has_access: true, fallback: true };
  }
}
\`\`\`

### Retry Logic

\`\`\`javascript
async function validateWithRetry(userId, maxRetries = 3) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await validateLicense(userId);
      return result;
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        // Esperar antes de reintentar (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }

  throw lastError;
}
\`\`\`

---

## Buenas Prácticas

### 1. Cache de Validaciones

No valides en cada request. Cachea el resultado por algunos minutos:

\`\`\`javascript
class LicenseCache {
  constructor(ttlMinutes = 5) {
    this.cache = new Map();
    this.ttl = ttlMinutes * 60 * 1000;
  }

  async get(userId, validateFn) {
    const cached = this.cache.get(userId);

    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;
    }

    const data = await validateFn(userId);
    this.cache.set(userId, {
      data,
      timestamp: Date.now(),
    });

    return data;
  }

  clear(userId) {
    if (userId) {
      this.cache.delete(userId);
    } else {
      this.cache.clear();
    }
  }
}

const licenseCache = new LicenseCache(5); // 5 minutos

async function validateCached(userId) {
  return licenseCache.get(userId, validateLicense);
}
\`\`\`

### 2. Validación en el Backend

Siempre valida las licencias también en el backend para operaciones críticas:

\`\`\`javascript
// backend/middleware/validateLicense.js
async function validateLicenseMiddleware(req, res, next) {
  const userId = req.user.id;

  const validation = await validateLicense(userId);

  if (!validation.has_access) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Your subscription is not active',
    });
  }

  req.license = validation;
  next();
}

// Uso en rutas
app.get('/api/protected-feature', validateLicenseMiddleware, (req, res) => {
  // El usuario tiene acceso verificado
  res.json({ data: 'sensitive data' });
});
\`\`\`

### 3. Mensajes de Usuario Amigables

\`\`\`javascript
function getLicenseMessage(validation) {
  if (!validation.has_access) {
    return {
      title: 'Acceso No Disponible',
      message: 'Tu suscripción no está activa. Por favor contacta a soporte.',
      action: 'Contactar Soporte',
    };
  }

  const { subscription } = validation;
  const daysLeft = Math.ceil(
    (new Date(subscription.period_end) - new Date()) / (1000 * 60 * 60 * 24)
  );

  if (subscription.status === 'trialing') {
    return {
      title: 'Periodo de Prueba',
      message: \`Te quedan \${daysLeft} días de prueba. Actualiza tu plan para continuar.\`,
      action: 'Ver Planes',
    };
  }

  if (daysLeft < 7) {
    return {
      title: 'Renovación Próxima',
      message: \`Tu suscripción se renueva en \${daysLeft} días.\`,
      action: 'Ver Detalles',
    };
  }

  return null; // Todo bien, no mostrar mensaje
}
\`\`\`

### 4. Telemetría y Logging

\`\`\`javascript
async function validateWithLogging(userId) {
  const startTime = Date.now();

  try {
    const result = await validateLicense(userId);

    // Log exitoso
    console.log('[LICENSE]', {
      userId,
      hasAccess: result.has_access,
      plan: result.subscription?.plan?.name,
      duration: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    // Log de error
    console.error('[LICENSE_ERROR]', {
      userId,
      error: error.message,
      duration: Date.now() - startTime,
    });

    throw error;
  }
}
\`\`\`

---

## Soporte

Si tienes problemas con la integración:

1. Verifica que tu API Key sea correcta
2. Revisa que el usuario tenga una suscripción activa
3. Consulta los logs en el Dashboard del sistema
4. Contacta al administrador del sistema

---

## Recursos Adicionales

- [Manual de Uso](./MANUAL_DE_USO.md)
- [Configuración de Autenticación](./CONFIGURACION_AUTH.md)
- API Reference: Disponible en el Dashboard

