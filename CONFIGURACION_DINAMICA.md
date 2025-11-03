# Configuración Dinámica desde API

Este documento explica cómo usar el sistema de configuración dinámica que obtiene las variables de entorno desde una API en lugar de usar archivos `.env` locales.

## 🎯 Ventajas

- ✅ **Centralizada:** Gestiona todas las configuraciones desde un solo lugar
- ✅ **Actualizaciones en tiempo real:** Cambia configuraciones sin redesplegar
- ✅ **Multi-ambiente:** Diferentes configuraciones por ambiente sin código duplicado
- ✅ **Seguridad:** No expones secretos en el repositorio
- ✅ **Cache inteligente:** Funciona offline con configuración cacheada

---

## 📡 API Endpoint

```
GET https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/get-env
```

### Headers Requeridos

```
X-Access-Key: tu-access-key-aqui
```

### Parámetros Opcionales

- `format`: `json` (default) o `raw`

---

## 📥 Ejemplo de Request

```bash
curl -X GET "https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/get-env?format=json" \
  -H "X-Access-Key: tu-access-key-aqui"
```

---

## 📤 Ejemplo de Response

```json
{
  "project_name": "subscription-manager",
  "description": "Configuración de producción",
  "variables": {
    "VITE_AUTH_API_KEY": "ak_production_0ec4bda83ca0d5c8bfea1bd31763e7d1",
    "VITE_AUTH_APP_ID": "app_bcc65e74-308",
    "VITE_AUTH_URL": "https://auth-licenses.netlify.app",
    "VITE_REDIRECT_URI": "https://tu-app.netlify.app/callback",
    "VITE_SUPABASE_URL": "https://yamuegahohdfyfxwobrk.supabase.co",
    "VITE_SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "updated_at": "2025-10-25T12:00:00Z"
}
```

---

## ⚙️ Configuración

### 1. Variable de Entorno Local

Agrega tu access key en el archivo `.env`:

```bash
VITE_CONFIG_ACCESS_KEY=tu-access-key-aqui
```

### 2. Configuración en Netlify

En **Site settings → Environment variables**, agrega:

```
VITE_CONFIG_ACCESS_KEY = tu-access-key-aqui
```

### 3. Por Ambiente (Opcional)

Puedes tener diferentes access keys por ambiente:

**Production:**
```
VITE_CONFIG_ACCESS_KEY = prod-access-key-123
```

**Staging:**
```
VITE_CONFIG_ACCESS_KEY = staging-access-key-456
```

**Development:**
```
VITE_CONFIG_ACCESS_KEY = dev-access-key-789
```

---

## 🔄 Flujo de Funcionamiento

### 1. Inicialización de la App

```typescript
// src/main.tsx
import { ConfigService } from './lib/config';

const accessKey = import.meta.env.VITE_CONFIG_ACCESS_KEY;

async function initializeApp() {
  if (accessKey) {
    try {
      ConfigService.setAccessKey(accessKey);
      await ConfigService.initialize();
      console.log('✅ Configuration loaded from API');
    } catch (error) {
      console.warn('⚠️ Failed to load remote config, using local env variables');
    }
  } else {
    console.log('ℹ️ No access key found, using local env variables');
  }

  // Render app...
}
```

### 2. Uso en la Aplicación

```typescript
// Las variables se obtienen dinámicamente
const authUrl = ConfigService.getVariable('VITE_AUTH_URL');
const apiKey = ConfigService.getVariable('VITE_AUTH_API_KEY');

// O todas juntas
const allVars = ConfigService.getAllVariables();
```

### 3. Fallback Automático

Si la API falla, el sistema automáticamente usa:
1. **Cache local** (válido por 1 hora)
2. **Variables de entorno** del archivo `.env`

```typescript
// auth.ts - Ejemplo de fallback
private static getAuthUrl(): string {
  return ConfigService.getVariable('VITE_AUTH_URL') ||
         import.meta.env.VITE_AUTH_URL ||
         '';
}
```

---

## 💾 Sistema de Cache

### Duración del Cache
- **1 hora** (3600 segundos)

### Ubicación
- **localStorage** del navegador

### Estrategia
```
1. Intenta cargar desde API
2. Si falla → usa cache (si está fresco)
3. Si no hay cache → usa .env local
4. Si todo falla → muestra error
```

---

## 🔧 API del ConfigService

### Métodos Principales

```typescript
// Establecer access key
ConfigService.setAccessKey('tu-access-key');

// Obtener access key actual
const key = ConfigService.getAccessKey();

// Cargar configuración desde API
await ConfigService.fetchConfig();

// Obtener configuración completa
const config = await ConfigService.getConfig();

// Obtener variable específica
const value = ConfigService.getVariable('VITE_AUTH_URL');

// Obtener todas las variables
const allVars = ConfigService.getAllVariables();

// Verificar si está configurado
const isConfigured = ConfigService.isConfigured();

// Limpiar cache
ConfigService.clearCache();

// Refrescar configuración (elimina cache y recarga)
await ConfigService.refreshConfig();

// Inicializar (cargar al inicio de la app)
await ConfigService.initialize();
```

---

## 🎨 Componente ConfigLoader

El sistema incluye un componente visual que muestra el estado de carga:

```tsx
import { ConfigLoader } from './components/ConfigLoader';

function App() {
  return (
    <ConfigLoader>
      <YourApp />
    </ConfigLoader>
  );
}
```

### Estados Visuales

1. **Loading** - Muestra spinner mientras carga
2. **Success** - Carga exitosa, renderiza la app
3. **Error** - Muestra error con botón de reintentar

---

## 🚀 Casos de Uso

### Desarrollo Local

```bash
# .env
VITE_CONFIG_ACCESS_KEY=dev-key-123
```

La app cargará la configuración de desarrollo desde la API.

### Staging

```bash
# Netlify Environment Variables
VITE_CONFIG_ACCESS_KEY=staging-key-456
```

Configuración específica para ambiente de pruebas.

### Producción

```bash
# Netlify Environment Variables
VITE_CONFIG_ACCESS_KEY=prod-key-789
```

Configuración de producción con credenciales reales.

### Sin API (Fallback)

```bash
# .env
# VITE_CONFIG_ACCESS_KEY=  (comentado o sin configurar)

VITE_AUTH_API_KEY=ak_production_xxx
VITE_AUTH_APP_ID=app_xxx
VITE_AUTH_URL=https://auth-licenses.netlify.app
VITE_REDIRECT_URI=http://localhost:5173/callback
```

La app usará las variables locales del `.env`.

---

## 🔐 Seguridad

### Protección del Access Key

1. **Nunca** commitees el access key en el repositorio
2. **Usa** variables de entorno en Netlify
3. **Rota** el access key periódicamente
4. **Restringe** el acceso al API endpoint por IP (si es posible)

### Variables Sensibles

Todas las variables (incluidas las secretas) se obtienen desde la API y nunca se exponen en el código fuente.

---

## 🧪 Testing

### Probar Carga desde API

```typescript
// En la consola del navegador
console.log('Config:', await ConfigService.getConfig());
console.log('Auth URL:', ConfigService.getVariable('VITE_AUTH_URL'));
```

### Simular Fallo de API

```typescript
// Desconecta internet o usa un access key inválido
// El sistema debe usar el cache o .env local
```

### Limpiar Cache

```typescript
// En la consola del navegador
ConfigService.clearCache();
location.reload();
```

---

## 🐛 Troubleshooting

### Error: "No access key configured"

**Solución:** Agrega `VITE_CONFIG_ACCESS_KEY` en tu `.env` o en Netlify.

### Error: "Failed to fetch config: 401"

**Solución:** Verifica que tu access key sea correcto.

### Error: "Failed to fetch config: 404"

**Solución:** Verifica que la URL del API esté correcta.

### La app usa configuración vieja

**Solución:**
```typescript
// Limpiar cache y recargar
ConfigService.clearCache();
await ConfigService.refreshConfig();
```

### Variables no se actualizan

**Solución:** El cache dura 1 hora. Para forzar actualización:
```typescript
await ConfigService.refreshConfig();
```

---

## 📊 Monitoring

### Logs en Consola

La app muestra logs útiles:

```
✅ Configuration loaded from API
⚠️ Failed to load remote config, using local env variables
ℹ️ No access key found, using local env variables
```

### Verificar Estado

```typescript
// En consola del navegador
console.log('Configured:', ConfigService.isConfigured());
console.log('Variables:', ConfigService.getAllVariables());
```

---

## 🔄 Actualización de Variables

### Proceso

1. Actualiza las variables en tu sistema de gestión de `.env`
2. Los clientes cargarán la nueva configuración:
   - **Inmediatamente** si abren la app después del cambio
   - **Máximo en 1 hora** si ya tenían la app abierta (cuando expire el cache)

### Forzar Actualización

Para que todos los usuarios obtengan la config inmediatamente:

1. Incrementa la versión de la app
2. O implementa un webhook/notificación que llame a `ConfigService.refreshConfig()`

---

## ✅ Checklist de Implementación

- [ ] Access key generado en el sistema de gestión de `.env`
- [ ] `VITE_CONFIG_ACCESS_KEY` configurado en `.env` local
- [ ] `VITE_CONFIG_ACCESS_KEY` configurado en Netlify
- [ ] Probado en desarrollo local
- [ ] Probado en staging
- [ ] Verificado fallback a `.env` local
- [ ] Cache funcionando correctamente
- [ ] Logs visibles en consola
- [ ] Documentación compartida con el equipo

---

## 📞 Soporte

Si tienes problemas con la configuración dinámica:

1. Verifica los logs en la consola del navegador
2. Verifica que el access key sea válido
3. Prueba el endpoint manualmente con `curl`
4. Revisa que las variables del `.env` API coincidan con las esperadas
