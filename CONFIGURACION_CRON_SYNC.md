# Configuración de Sincronización Automática de Aplicaciones

## 🎯 Descripción

Esta API sincroniza automáticamente las aplicaciones desde el sistema de autenticación externo hacia la base de datos de licencias. Solo registra aplicaciones nuevas, las existentes se omiten.

---

## 🔗 Endpoint de la API

```
https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/sync-applications
```

**Método:** `GET` o `POST`

**Autenticación:** No requiere autenticación (la función usa credenciales internas)

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

### Usando cURL

```bash
curl -X GET https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/sync-applications
```

### Usando el Navegador

Simplemente abre esta URL en tu navegador:
```
https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/sync-applications
```

### Usando Postman

1. Método: `GET`
2. URL: `https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/sync-applications`
3. Click en "Send"

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
- La API **NO requiere autenticación externa** (usa credenciales de Supabase internas)
- Sin embargo, solo puede **crear** aplicaciones, no modificar o eliminar
- Las API Keys generadas son únicas y seguras

### Errores Comunes

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
