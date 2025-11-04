# 🚀 Guía Rápida: Configurar CRON en 3 Pasos

## Paso 1: Obtener tu Supabase Anon Key

1. Ve a: https://yamuegahohdfyfxwobrk.supabase.co
2. Click en **Settings** → **API**
3. Copia el **"anon" public key** (comienza con `eyJhbG...`)

## Paso 2: Configurar Cron-Job.org

### Registro
1. Ve a https://cron-job.org
2. Crea una cuenta o inicia sesión

### Crear el Job
1. Click en **"Create cronjob"**
2. Completa:

   **Title:**
   ```
   Sync Applications from Auth System
   ```

   **URL:**
   ```
   https://yamuegahohdfyfxwobrk.supabase.co/functions/v1/sync-applications
   ```

   **Method:**
   ```
   GET
   ```

   **Schedule (Elige uno):**
   - Cada hora: `0 * * * *`
   - Cada 6 horas: `0 0,6,12,18 * * *`
   - Diario a las 3 AM: `0 3 * * *`

### Configurar Headers (IMPORTANTE)

En la sección **"Headers"** o **"Request Headers"**:

| Key | Value |
|-----|-------|
| `Authorization` | `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

⚠️ Reemplaza el valor con tu Supabase Anon Key del Paso 1

## Paso 3: Activar y Probar

1. Click en **"Create cronjob"**
2. El job quedará activo automáticamente
3. Para probar inmediatamente, click en **"Run now"** o **"Execute"**

## ✅ Verificar que Funciona

### En Cron-Job.org
1. Ve a tu job
2. Click en **"History"**
3. Deberías ver ejecuciones exitosas (status 200)

### En tu Dashboard
1. Ve a tu panel de administración
2. Click en **"Aplicaciones"**
3. Deberías ver las aplicaciones sincronizadas

## 🆘 Problemas Comunes

### Error 401: Unauthorized
- Verifica que agregaste el header `Authorization`
- Verifica que el valor sea `Bearer TU_ANON_KEY` (con "Bearer " al inicio)
- Verifica que copiaste el anon key completo

### No aparecen nuevas aplicaciones
- Puede que todas las aplicaciones ya estén registradas
- Revisa el history del cron para ver el resumen de la sincronización

## 📚 Documentación Completa

Para más detalles, consulta: `CONFIGURACION_CRON_SYNC.md`
