# Sistema de Configuración de Variables

## Arquitectura de Configuración

Esta aplicación utiliza un **sistema de configuración centralizado externo** para gestionar todas las variables de entorno.

### API de Configuración Externa

**Endpoint:** `https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/get-env`
**Access Key:** `033b6f38b0c5b902c90dbb1f371c389f967a0afa871028da2ab5657062cab866`

### Cómo Funciona

1. **Al iniciar la aplicación**, el `ConfigLoader` hace una petición a la API externa
2. **La API responde** con todas las variables de configuración
3. **Las variables se cachean** en localStorage por 1 hora
4. **La aplicación usa** las variables cacheadas mientras funciona

### Implementación

Ver: `src/lib/config.ts`

```typescript
const ENV_API_URL = 'https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/get-env';
const ACCESS_KEY = '033b6f38b0c5b902c90dbb1f371c389f967a0afa871028da2ab5657062cab866';
```

## Variables Actuales

Estas son las variables que la aplicación espera del servidor de configuración:

### Variables de Autenticación

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `VITE_AUTH_URL` | URL del sistema de autenticación | `https://auth-licenses.netlify.app` |
| `VITE_AUTH_APP_ID` | ID de la aplicación en el sistema de auth | `app_bcc65e74-308` |
| `VITE_AUTH_API_KEY` | API Key para autenticación | `ak_production_...` |
| `VITE_REDIRECT_URI` | URL de callback después de login | `https://tu-app.netlify.app/callback` |
| `AUTH_VALIDA_TOKEN` | Endpoint para intercambio de código | `https://sfqtmnncgiqkveaoqckt.supabase.co/functions/v1/auth-exchange-code` |

### Variables de Base de Datos

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | URL de Supabase | `https://veymthufmfqhxxxzfmfi.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Anon key de Supabase | `eyJhbGci...` |

### Variables de MercadoPago

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `MERCADOPAGO_ACCESS_TOKEN` | Token de acceso de MercadoPago | `APP_USR-...` |
| `MERCADOPAGO_API_URL` | URL de la API de MercadoPago | `https://api.mercadopago.com/preapproval_plan` |
| `MERCADOPAGO_BACK_URL` | URL de retorno después del pago | `https://tu-app.netlify.app` |

## Diferencia con Base de Datos Local

⚠️ **Importante:** Esta aplicación tiene su propia base de datos Supabase, pero **NO** usa su tabla `app_config` para variables de entorno.

### Base de Datos Local (veymthufmfqhxxxzfmfi.supabase.co)
- Se usa para: tenants, applications, plans, subscriptions, licenses, payments
- **NO** se usa para: variables de configuración

### Servidor de Configuración Externo (ffihaeatoundrjzgtpzk.supabase.co)
- Se usa exclusivamente para: variables de configuración
- Centraliza la configuración de múltiples aplicaciones

## Modificar Variables

### Para actualizar variables existentes:

Las variables se modifican en el **servidor de configuración externo**, no en esta aplicación.

### Para agregar nuevas variables:

1. **Agrégala en el servidor externo** (ffihaeatoundrjzgtpzk.supabase.co)
2. **Úsala en el código:**

```typescript
import { ConfigService } from '../lib/config';

const miVariable = ConfigService.getVariable('MI_NUEVA_VARIABLE');
```

3. **Opcional:** Crea un método helper en `ConfigService`:

```typescript
static getMiVariable(): string | undefined {
  return this.getVariable('MI_NUEVA_VARIABLE');
}
```

## Cache y Actualización

### Cache Duration
Las variables se cachean por **1 hora** (3600000 ms) en localStorage.

### Forzar Actualización

```typescript
// En el código
await ConfigService.refreshConfig();

// Limpia el cache
ConfigService.clearCache();
```

### Verificar Variables Cargadas

```typescript
// Verificar si está configurado
const isConfigured = ConfigService.isConfigured();

// Obtener todas las variables
const allVars = ConfigService.getAllVariables();

// Obtener variable específica
const authUrl = ConfigService.getVariable('VITE_AUTH_URL');
```

## Ventajas de este Sistema

✅ **Centralizado**: Una sola fuente de verdad para configuración
✅ **Sin rebuilds**: Cambiar variables no requiere recompilar la aplicación
✅ **Multi-ambiente**: Fácil cambiar entre dev, staging, production
✅ **Seguro**: Las API keys no están en el código fuente
✅ **Cacheado**: Rendimiento optimizado con cache local
✅ **Fallback**: Si falla la API, usa el cache local

## Troubleshooting

### "Configuración no disponible"

**Causa:** No se pudieron cargar las variables desde la API

**Solución:**
1. Verifica que la API esté funcionando: `https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/get-env`
2. Verifica el Access Key en `src/lib/config.ts`
3. Revisa la consola del navegador para errores

### Variables desactualizadas

**Causa:** El cache aún no ha expirado

**Solución:**
```javascript
// En la consola del navegador
localStorage.removeItem('app_config');
location.reload();
```

### Variable undefined

**Causa:** La variable no existe en el servidor de configuración

**Solución:**
1. Verifica el nombre exacto de la variable (case-sensitive)
2. Confirma que existe en el servidor externo
3. Fuerza actualización: `ConfigService.refreshConfig()`

## Variables con Typo Conocido

⚠️ **AUTH_VALIDA_TOKEN** - El nombre correcto debería ser `AUTH_VALIDATE_TOKEN`, pero mantiene el typo por compatibilidad con el servidor externo. El código usa el nombre correcto que está en el servidor.
