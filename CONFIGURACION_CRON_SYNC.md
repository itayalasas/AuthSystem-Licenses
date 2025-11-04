# Configuración de Sincronización Automática de Aplicaciones

## 🎯 Descripción

Esta API sincroniza automáticamente las aplicaciones desde el sistema de autenticación externo hacia la base de datos de licencias. Solo registra aplicaciones nuevas, las existentes se omiten.

---

## 🔗 Endpoint de la API

```
https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/sync-applications
```

**Método:** `GET` o `POST`

**Autenticación:** Requiere una de las siguientes opciones:

### Opción 1: Bearer Token en Header (⭐ Recomendado)
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlhb...
```
Esta es la forma **más segura** porque el token va en el header, no en la URL.

### Opción 2: Secret en Query Parameter (Alternativa)
```
https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/sync-applications?secret=TU_SECRET_AQUI
```
⚠️ Menos seguro porque el secret queda visible en logs y URLs.

---

## 📋 Respuesta de la API

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Application sync completed",
  "summary": {
    "total_external": 6,
    "already_exists": 3,
    "newly_created": 3,
    "failed": 0
  },
  "created_applications": [
    {
      "name": "CRM Pro",
      "slug": "crm-pro",
      "external_app_id": "app_a6f840c5-bd1",
      "api_key": "sk_live_abc123..."
    }
  ],
  "errors": [],
  "timestamp": "2025-11-04T12:00:00.000Z"
}
```

### Respuesta con Error

```json
{
  "success": false,
  "error": "External API returned status 500",
  "timestamp": "2025-11-04T12:00:00.000Z"
}
```

---

## ⚙️ Configuración en Cron-Job.org

### Paso 1: Crear Cuenta
1. Ve a [Cron-Job.org](https://cron-job.org)
2. Regístrate o inicia sesión

### Paso 2: Crear Nuevo Cron Job
1. Click en **"Create cronjob"**
2. Completa los siguientes campos:

#### **Configuración Básica**

- **Title:** `Sync Applications from Auth System`
- **Address (URL):**
  ```
  https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/sync-applications
  ```

- **Request method:** `GET`

#### **Configuración de Headers** (⭐ Recomendado)

Agrega un header personalizado para autenticación:

1. En Cron-Job.org, busca la sección **"Headers"** o **"Request Headers"**
2. Agrega un nuevo header:
   - **Key:** `Authorization`
   - **Value:** `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

**Obtener tu Supabase Anon Key:**
1. Ve a tu proyecto en Supabase Dashboard
2. Settings → API
3. Copia el **"anon" / "public"** key
4. Úsalo como: `Bearer TU_ANON_KEY_AQUI`

#### **Alternativa: Usando Query Parameter** (Menos seguro)

Si Cron-Job.org no permite configurar headers, puedes usar:
```
https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/sync-applications?secret=MI_SECRET_SEGURO_123
```

Genera un secret seguro:
```bash
openssl rand -hex 32
```

#### **Configuración de Ejecución**

Elige una de estas opciones según tus necesidades:

##### **Opción 1: Cada hora** (Recomendado)
```
Every hour at minute 0
```
Patrón cron: `0 * * * *`

##### **Opción 2: Cada 6 horas**
```
At 00:00, 06:00, 12:00, and 18:00
```
Patrón cron: `0 0,6,12,18 * * *`

##### **Opción 3: Diario a las 3 AM**
```
Every day at 3:00 AM
```
Patrón cron: `0 3 * * *`

##### **Opción 4: Cada 30 minutos** (Alta frecuencia)
```
Every 30 minutes
```
Patrón cron: `*/30 * * * *`

#### **Configuración Avanzada** (Opcional)

- **Request timeout:** `30 segundos`
- **Save responses:** ✅ Activar (para ver los logs)
- **Notifications:**
  - ✅ Notify me on failure
  - Email: tu-email@ejemplo.com

### Paso 3: Guardar
1. Click en **"Create cronjob"**
2. El job se activará automáticamente

---

## 🧪 Probar la Sincronización Manualmente

### Opción 1: Usando cURL con Secret

```bash
curl -X GET "https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/sync-applications?secret=MI_SECRET_SEGURO_123"
```

### Opción 2: Usando cURL con Bearer Token (⭐ Recomendado)

```bash
curl -X GET https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/sync-applications \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

Reemplaza el token con tu **Supabase Anon Key** (Settings → API en Supabase Dashboard)

### Usando el Navegador

Simplemente abre esta URL en tu navegador (con el secret):
```
https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/sync-applications?secret=MI_SECRET_SEGURO_123
```

### Usando Postman

#### Con Secret en Query Param:
1. Método: `GET`
2. URL: `https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/sync-applications`
3. En "Params" agrega:
   - Key: `secret`
   - Value: `MI_SECRET_SEGURO_123`
4. Click en "Send"

#### Con Bearer Token:
1. Método: `GET`
2. URL: `https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/sync-applications`
3. En "Headers" agrega:
   - Key: `Authorization`
   - Value: `Bearer TU_SUPABASE_ANON_KEY`
4. Click en "Send"

---

## 📊 Cómo Funciona

1. **Obtiene aplicaciones** del sistema externo:
   ```
   https://auth-systemv1.netlify.app/api/application/info
   ```

2. **Compara** con las aplicaciones existentes en la base de datos

3. **Registra solo las nuevas** aplicaciones con:
   - Nombre de la aplicación
   - Slug generado automáticamente
   - External App ID (del sistema de auth)
   - URL del webhook
   - Configuración de entornos
   - API Key generada automáticamente

4. **Retorna un resumen** con:
   - Total de aplicaciones en el sistema externo
   - Cuántas ya existían
   - Cuántas se crearon nuevas
   - Errores (si los hubo)

---

## 🔍 Verificar que Funcionó

### En el Dashboard

1. Ve al Dashboard de administración
2. Click en **"Aplicaciones"**
3. Deberías ver las nuevas aplicaciones registradas

### En la Base de Datos

```sql
SELECT
  name,
  slug,
  external_app_id,
  is_active,
  created_at
FROM applications
ORDER BY created_at DESC;
```

---

## 📈 Monitoreo

### Ver Logs en Supabase

1. Ve a [Supabase Dashboard](https://yamuegahohdfyfxwobrk.supabase.co)
2. Click en **"Edge Functions"**
3. Selecciona **"sync-applications"**
4. Ve a la pestaña **"Logs"**

### Ver Historial en Cron-Job.org

1. Ve a tu dashboard en Cron-Job.org
2. Click en el job **"Sync Applications"**
3. Ve a la pestaña **"History"**
4. Verás todas las ejecuciones con sus respuestas

---

## ⚠️ Consideraciones Importantes

### Aplicaciones Existentes
- Las aplicaciones que ya existen **NO se modifican**
- Solo se compara por `external_app_id`
- Si una app fue eliminada del sistema externo, **NO** se elimina de la base de datos

### Límites
- La función tiene un timeout de **60 segundos**
- Puede procesar cientos de aplicaciones sin problema
- Si tienes miles de apps, considera paginar la sincronización

### Seguridad

#### ⭐ Método Recomendado: Bearer Token
- Usa el **Supabase Anon Key** en el header `Authorization`
- Es seguro porque:
  - El anon key está diseñado para ser público
  - Las RLS policies protegen los datos
  - No aparece en logs de URLs
  - Es el estándar de la industria

#### Método Alternativo: Query Parameter Secret
- Usa un secret personalizado en `?secret=TU_SECRET`
- Menos seguro porque:
  - El secret aparece en la URL
  - Puede quedar registrado en logs
  - Requiere configuración adicional

#### Configurar CRON_SECRET (Solo si usas Query Parameter)

Si prefieres usar `?secret=`, configura la variable de entorno:

1. Ve a tu proyecto en Supabase Dashboard
2. Settings → Edge Functions → Environment Variables
3. Agrega:
   - **Name:** `CRON_SECRET`
   - **Value:** `tu-secret-super-seguro-generado`
4. Guarda los cambios

Si no configuras `CRON_SECRET`, la función usa un valor por defecto.

#### Permisos
- La función solo puede **crear** aplicaciones, no modificar o eliminar
- Las API Keys generadas son únicas y seguras
- Respeta todas las RLS policies de la base de datos

### Errores Comunes

#### Error 401: "Unauthorized - provide valid authentication"
- No se proporcionó el secret o el Bearer token
- El secret proporcionado es incorrecto
- **Solución:** Verifica que estés usando `?secret=TU_SECRET` en la URL o el header `Authorization: Bearer TOKEN`

#### Error: "External API returned status 500"
- El sistema de autenticación externo no está disponible
- Verifica: https://auth-systemv1.netlify.app/api/application/info

#### Error: "Failed to fetch existing applications"
- Problema de conexión con Supabase
- Verifica que la base de datos esté activa

#### Error: "Failed to create [App Name]"
- Puede ser un problema de duplicados
- O campos inválidos en los datos del sistema externo

---

## 🎯 Frecuencia Recomendada

- **Producción:** Cada 6 horas o diariamente
- **Desarrollo:** Cada hora
- **Alta demanda:** Cada 30 minutos

No se recomienda ejecutarlo más de una vez cada 15 minutos para evitar carga innecesaria.

---

## 📞 Soporte

Si tienes problemas con la sincronización:

1. Verifica los logs en Supabase
2. Verifica el historial en Cron-Job.org
3. Prueba manualmente con cURL
4. Verifica que el sistema externo esté disponible

---

## 🔄 Actualizaciones Futuras

En futuras versiones se podría agregar:

- Sincronización bidireccional (actualizar apps existentes)
- Sincronización de cambios de estado
- Webhooks para notificar cuando se crean nuevas apps
- Dashboard de sincronización en tiempo real
