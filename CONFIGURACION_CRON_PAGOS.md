# Configuración de Cron Jobs para el Sistema de Pagos

Este documento explica cómo configurar las verificaciones automáticas del sistema de pagos.

## Tareas Automáticas Requeridas

### 1. Verificación de Pruebas Expiradas
**Endpoint:** `POST /payment-manager/check-trials`
**Frecuencia:** Diaria (recomendado: 2:00 AM)
**Propósito:** Detecta suscripciones en período de prueba que han expirado sin pago

### 2. Verificación de Renovaciones
**Endpoint:** `POST /payment-manager/check-renewals`
**Frecuencia:** Diaria (recomendado: 3:00 AM)
**Propósito:** Detecta suscripciones activas que requieren renovación

## Configuración en Diferentes Plataformas

### Opción 1: Supabase Cron Jobs (Recomendado)

Supabase permite ejecutar funciones PostgreSQL en intervalos programados usando pg_cron.

#### Paso 1: Habilitar pg_cron
1. Ve al Dashboard de Supabase
2. Ve a Database → Extensions
3. Busca y habilita la extensión `pg_cron`

#### Paso 2: Crear las tareas programadas

Ejecuta estos comandos SQL en el SQL Editor de Supabase:

```sql
-- Crear función para llamar al endpoint de verificación de pruebas
CREATE OR REPLACE FUNCTION trigger_check_trials()
RETURNS void AS $$
DECLARE
  result json;
BEGIN
  PERFORM check_trial_expiration();
END;
$$ LANGUAGE plpgsql;

-- Crear función para llamar al endpoint de verificación de renovaciones
CREATE OR REPLACE FUNCTION trigger_check_renewals()
RETURNS void AS $$
DECLARE
  result json;
BEGIN
  PERFORM check_subscription_renewal();
END;
$$ LANGUAGE plpgsql;

-- Programar verificación de pruebas (todos los días a las 2:00 AM UTC)
SELECT cron.schedule(
  'check-trial-expirations',
  '0 2 * * *',
  $$SELECT trigger_check_trials();$$
);

-- Programar verificación de renovaciones (todos los días a las 3:00 AM UTC)
SELECT cron.schedule(
  'check-subscription-renewals',
  '0 3 * * *',
  $$SELECT trigger_check_renewals();$$
);
```

#### Verificar tareas programadas
```sql
SELECT * FROM cron.job;
```

#### Eliminar una tarea (si es necesario)
```sql
SELECT cron.unschedule('check-trial-expirations');
SELECT cron.unschedule('check-subscription-renewals');
```

### Opción 2: Cron-job.org (Servicio Externo)

Si prefieres usar un servicio externo gratuito:

1. Ve a [cron-job.org](https://cron-job.org)
2. Crea una cuenta gratuita
3. Crea dos nuevos cron jobs:

#### Job 1: Verificación de Pruebas
- **URL:** `https://[tu-proyecto-id].supabase.co/functions/v1/payment-manager/check-trials`
- **Método:** POST
- **Headers:**
  ```
  Authorization: Bearer [tu-anon-key]
  Content-Type: application/json
  ```
- **Schedule:** Diario a las 2:00 AM

#### Job 2: Verificación de Renovaciones
- **URL:** `https://[tu-proyecto-id].supabase.co/functions/v1/payment-manager/check-renewals`
- **Método:** POST
- **Headers:**
  ```
  Authorization: Bearer [tu-anon-key]
  Content-Type: application/json
  ```
- **Schedule:** Diario a las 3:00 AM

### Opción 3: GitHub Actions (Para proyectos en GitHub)

Crea el archivo `.github/workflows/payment-checks.yml`:

```yaml
name: Payment System Checks

on:
  schedule:
    # Verificar pruebas a las 2:00 AM UTC
    - cron: '0 2 * * *'
    # Verificar renovaciones a las 3:00 AM UTC
    - cron: '0 3 * * *'
  workflow_dispatch:

jobs:
  check-trials:
    runs-on: ubuntu-latest
    if: github.event.schedule == '0 2 * * *' || github.event_name == 'workflow_dispatch'
    steps:
      - name: Check Trial Expirations
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            https://${{ secrets.SUPABASE_PROJECT_ID }}.supabase.co/functions/v1/payment-manager/check-trials

  check-renewals:
    runs-on: ubuntu-latest
    if: github.event.schedule == '0 3 * * *' || github.event_name == 'workflow_dispatch'
    steps:
      - name: Check Subscription Renewals
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            https://${{ secrets.SUPABASE_PROJECT_ID }}.supabase.co/functions/v1/payment-manager/check-renewals
```

**Configurar Secrets en GitHub:**
1. Ve a Settings → Secrets and variables → Actions
2. Agrega:
   - `SUPABASE_PROJECT_ID`: Tu ID de proyecto Supabase
   - `SUPABASE_ANON_KEY`: Tu clave anon de Supabase

### Opción 4: Vercel Cron Jobs

Si tu frontend está en Vercel, puedes usar Vercel Cron Jobs.

Crea el archivo `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-trials",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/check-renewals",
      "schedule": "0 3 * * *"
    }
  ]
}
```

Crea los archivos de API:

**`api/cron/check-trials.ts`:**
```typescript
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(
      `${process.env.VITE_SUPABASE_URL}/functions/v1/payment-manager/check-trials`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to check trials' });
  }
}
```

**`api/cron/check-renewals.ts`:**
```typescript
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(
      `${process.env.VITE_SUPABASE_URL}/functions/v1/payment-manager/check-renewals`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to check renewals' });
  }
}
```

### Opción 5: Netlify Functions + Scheduled Functions

Si usas Netlify, puedes usar Netlify Scheduled Functions.

Instala la dependencia:
```bash
npm install @netlify/functions
```

Crea `netlify/functions/check-trials.ts`:
```typescript
import { schedule } from '@netlify/functions';

export const handler = schedule('0 2 * * *', async () => {
  try {
    const response = await fetch(
      `${process.env.VITE_SUPABASE_URL}/functions/v1/payment-manager/check-trials`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to check trials' }),
    };
  }
});
```

Crea `netlify/functions/check-renewals.ts` de forma similar.

## Pruebas Manuales

Puedes ejecutar las verificaciones manualmente para probar:

### Usando curl:
```bash
# Verificar pruebas expiradas
curl -X POST \
  -H "Authorization: Bearer [tu-anon-key]" \
  https://[tu-proyecto-id].supabase.co/functions/v1/payment-manager/check-trials

# Verificar renovaciones
curl -X POST \
  -H "Authorization: Bearer [tu-anon-key]" \
  https://[tu-proyecto-id].supabase.co/functions/v1/payment-manager/check-renewals
```

### Usando Postman:
1. Método: POST
2. URL: `https://[tu-proyecto-id].supabase.co/functions/v1/payment-manager/check-trials`
3. Headers:
   - `Authorization: Bearer [tu-anon-key]`
   - `Content-Type: application/json`

## Monitoreo y Logs

### Ver logs en Supabase
1. Ve a Edge Functions en el Dashboard
2. Selecciona la función `payment-manager`
3. Ve a la pestaña Logs

### Verificar ejecuciones de cron (si usas pg_cron)
```sql
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

### Alertas Recomendadas
Configura alertas para:
- Suscripciones que cambian a `past_due`
- Suscripciones que cambian a `expired`
- Fallos en verificaciones de cron

## Mejores Prácticas

1. **Redundancia**: Considera usar múltiples métodos (pg_cron + servicio externo)
2. **Monitoreo**: Revisa los logs regularmente
3. **Zona Horaria**: Todas las horas están en UTC, ajusta según tu zona horaria
4. **Notificaciones**: Implementa notificaciones por email cuando expiren pruebas
5. **Intervalo**: No ejecutes con demasiada frecuencia para evitar carga innecesaria

## Solución de Problemas

### Los cron jobs no se ejecutan
1. Verifica que las URLs sean correctas
2. Verifica que la API key tenga permisos suficientes
3. Revisa los logs de la Edge Function
4. Verifica que pg_cron esté habilitado (si usas Supabase Cron)

### Las verificaciones no actualizan suscripciones
1. Verifica que las funciones SQL existan (`check_trial_expiration`, `check_subscription_renewal`)
2. Revisa los permisos RLS
3. Ejecuta las funciones manualmente para ver errores

### Cron jobs duplicados
1. Verifica que solo tengas un método de cron activo
2. Elimina tareas duplicadas en pg_cron si es necesario

## Recursos Adicionales

- [Documentación de pg_cron](https://github.com/citusdata/pg_cron)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Cron expression syntax](https://crontab.guru/)
