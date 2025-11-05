# Changelog - Sistema de Licencias

## Versión 2.0 - Sistema de Licencias Automático (2025-11-05)

### 🎉 Nuevas Funcionalidades

#### 1. Auto-generación de Licencias al Registrarse
- **Cambio:** Los usuarios ahora reciben automáticamente una licencia de prueba al registrarse
- **Plan por defecto:** Starter (antes era Free)
- **Duración del trial:** 14 días
- **Duración de licencia:** 24 horas (se regenera automáticamente)
- **Implementación:**
  - Modificado `tenant-onboarding` para buscar plan "Starter"
  - Genera automáticamente licencia temporal al crear suscripción
  - Incluye `entitlements` del plan en la licencia

#### 2. Modal de Usuarios Mejorado
- **Componente:** `ApplicationUsersModal.tsx`
- **Nuevas secciones:**
  - 📊 **Tarjeta de Suscripción** (azul): Estado, plan, precio, fechas de trial y período
  - 🔑 **Tarjeta de Licencia** (verde): Estado, tipo, token JTI, fecha de expiración
  - ⚠️ **Alerta sin licencia** (amarilla): Cuando el usuario no tiene suscripción activa
- **Acciones disponibles:**
  - 🔄 Renovar Licencia (preparado para implementación)
  - ❌ Cancelar Suscripción (preparado para implementación)

#### 3. Nueva Tabla en Base de Datos
```sql
CREATE TABLE licenses (
  id uuid PRIMARY KEY,
  jti uuid UNIQUE NOT NULL,  -- Token único JWT ID
  tenant_id uuid REFERENCES tenants(id),
  subscription_id uuid REFERENCES subscriptions(id),
  type text CHECK (type IN ('trial', 'paid', 'lifetime', 'promotional')),
  status text CHECK (status IN ('active', 'expired', 'revoked', 'suspended')),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  last_validated_at timestamptz,
  entitlements jsonb,
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz
);
```

### 🔄 APIs Actualizadas

#### 1. `POST /tenant-onboarding`
**Cambios:**
- Ahora busca automáticamente el plan "Starter" (línea 143)
- Genera licencia temporal automáticamente (líneas 212-226)
- La licencia se crea inmediatamente después de la suscripción

**Comportamiento nuevo:**
```javascript
// Antes
Plan por defecto: "Free"
Licencia: No se generaba

// Ahora
Plan por defecto: "Starter"
Licencia: Se genera automáticamente (24h de validez)
```

#### 2. `GET /admin-api/applications/{id}/users`
**Cambios importantes:**
- Ahora enriquece cada usuario con datos de tenant, subscription y license (líneas 533-587)
- Incluye la licencia activa más reciente del usuario
- Response incluye información completa de entitlements

**Response anterior:**
```json
{
  "id": "...",
  "external_user_id": "...",
  "email": "...",
  "name": "...",
  "status": "active"
}
```

**Response nuevo:**
```json
{
  "id": "...",
  "external_user_id": "...",
  "email": "...",
  "name": "...",
  "status": "active",
  "tenant": {
    "id": "...",
    "name": "...",
    "status": "active"
  },
  "subscription": {
    "id": "...",
    "status": "trialing",
    "plan_name": "Starter",
    "plan_price": 15,
    "plan_currency": "USD",
    "trial_end": "2025-11-19T...",
    "entitlements": { }
  },
  "license": {
    "id": "...",
    "jti": "a1b2c3d4-...",
    "type": "trial",
    "status": "active",
    "expires_at": "2025-11-06T...",
    "entitlements": { }
  }
}
```

#### 3. `POST /validation-api/validate-user`
**Cambios:**
- Response simplificado sin duplicación de datos
- Estructura más limpia y eficiente
- Misma funcionalidad, mejor organización

### 📝 Nueva Documentación

#### Archivos creados:
1. **`GUIA_API_LICENCIAS.md`** - Documentación completa del sistema de licencias
   - Descripción de todos los cambios
   - Ejemplos de requests y responses
   - Tipos de TypeScript
   - Diagrama de flujo de usuario nuevo
   - Próximos pasos recomendados

2. **`CHANGELOG_LICENCIAS.md`** - Este archivo (registro de cambios)

#### Archivos actualizados:
1. **`src/pages/ApiDocs.tsx`** - Banner verde informando sobre cambios de licencias
2. **`README.md`** - (Puede requerir actualización con nuevas funcionalidades)

### 🔧 Archivos Modificados

#### Backend (Edge Functions):
- ✅ `supabase/functions/tenant-onboarding/index.ts` (líneas 140-150, 212-226)
- ✅ `supabase/functions/admin-api/index.ts` (líneas 522-595)
- ✅ `supabase/functions/validation-api/index.ts` (respuesta simplificada)

#### Frontend (React):
- ✅ `src/components/ApplicationUsersModal.tsx` (rediseñado completamente)
- ✅ `src/lib/admin-api.ts` (nuevos tipos: License, Subscription)
- ✅ `src/pages/ApiDocs.tsx` (banner informativo)

#### Base de Datos:
- ✅ Nueva migración: `create_licenses_table.sql`
- ✅ Tabla `licenses` con índices y RLS
- ✅ Función `cleanup_expired_licenses()` para mantenimiento

### 🎨 Cambios en la UI

#### Modal de Usuarios
**Antes:**
- Lista simple de usuarios
- Solo información básica (email, nombre, último acceso)
- Sin información de suscripción o licencia

**Ahora:**
- Cards expandidos con información completa
- Tarjetas de colores para suscripción y licencia
- Indicadores visuales de estado
- Botones de acción (Renovar, Cancelar)
- Alertas para usuarios sin licencia

#### Página de API Docs
**Antes:**
- Solo banner amarillo con información general

**Ahora:**
- Banner amarillo con información general
- **Nuevo:** Banner verde destacando el sistema de licencias

### 🚀 Despliegues Realizados

#### Edge Functions desplegadas:
1. ✅ `validation-api` - Con respuesta simplificada y tabla de licencias
2. ✅ `tenant-onboarding` - Con auto-generación de licencias
3. ✅ `admin-api` - Con endpoint de usuarios enriquecido

**Nota:** Las funciones se redesplegan automáticamente en Supabase.

### 📊 Estadísticas de Cambios

```
Archivos modificados:     7
Archivos creados:         3 (2 docs + 1 migration)
Líneas agregadas:         ~800
Líneas modificadas:       ~150
Edge Functions actualizadas: 3
Nuevas tablas:            1 (licenses)
Nuevos tipos TypeScript:  2 (License, Subscription)
```

### ✅ Testing Realizado

- ✅ Build del proyecto exitoso
- ✅ TypeScript sin errores
- ✅ Todas las importaciones correctas
- ✅ Edge Functions desplegadas correctamente

### 🔜 Próximos Pasos Sugeridos

#### 1. Implementar Renovación de Licencias
```typescript
// Endpoint sugerido
POST /admin-api/licenses/{license_id}/renew

// Lógica
- Extender expires_at por 24 horas más
- Mantener status como 'active'
- Registrar en metadata la renovación
```

#### 2. Implementar Cancelación de Suscripciones
```typescript
// Endpoint sugerido
DELETE /admin-api/subscriptions/{subscription_id}

// Lógica
- Cambiar status a 'canceled'
- Establecer cancel_at para fin de período
- Revocar licencias activas
- Notificar al usuario
```

#### 3. Auto-renovación de Licencias
```sql
-- Función a crear
CREATE OR REPLACE FUNCTION auto_renew_licenses()
RETURNS void AS $$
BEGIN
  -- Para cada licencia que expira en las próximas 2 horas
  -- Y cuya suscripción está activa
  -- Crear una nueva licencia
END;
$$ LANGUAGE plpgsql;

-- Ejecutar con cron cada hora
```

#### 4. Métricas y Monitoreo
- Agregar endpoint para ver estadísticas de licencias
- Dashboard con gráficas de licencias activas vs expiradas
- Alertas cuando muchas licencias estén por expirar

### 🐛 Issues Conocidos

Ninguno reportado hasta el momento.

### 💡 Notas Importantes

1. **Licencias temporales:** Las licencias duran 24 horas y deben renovarse automáticamente
2. **Plan Starter por defecto:** Todos los usuarios nuevos reciben este plan
3. **Cleanup automático:** Se puede ejecutar `cleanup_expired_licenses()` con un cron job
4. **RLS Habilitado:** Todas las operaciones en la tabla `licenses` están protegidas

### 📞 Contacto

Para dudas sobre esta implementación:
- Revisar `GUIA_API_LICENCIAS.md` para detalles técnicos
- Verificar logs en Supabase Dashboard
- Consultar tipos en `src/lib/admin-api.ts`

---

**Autor:** Sistema de Admin de Suscripciones
**Fecha:** 2025-11-05
**Versión:** 2.0.0
